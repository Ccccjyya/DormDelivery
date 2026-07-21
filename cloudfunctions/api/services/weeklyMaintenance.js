const { loadRules, bandForScore, ruleSnapshot } = require('./businessRules');

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 20;
const { assertActive } = require('../common/permissions');
const { ok } = require('../common/response');

function shanghaiMonday(reference = new Date()) {
  const shifted = new Date(reference.getTime() + 8 * 60 * 60 * 1000);
  const day = shifted.getUTCDay() || 7;
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() - day + 1);
  return new Date(shifted.getTime() - 8 * 60 * 60 * 1000);
}

function isoWeekKey(periodEnd) {
  const local = new Date(periodEnd.getTime() + 8 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / DAY_MS) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function computeWeeklySettlement({ user, rules, completedDeliveryCount, rewardedDeliveryCount, overtimeDeliveryCount, now, periodStart, periodEnd, weekKey }) {
  const scoreBefore = Math.max(0, Math.min(100, Number(user.contributionScore ?? 60)));
  const oldPostingQuota = Math.max(0, Number(user.postingQuota || 0));
  const createdAt = user.createdAt ? new Date(user.createdAt) : null;
  const newUserProtected = Boolean(createdAt && Number.isFinite(createdAt.getTime()) && now.getTime() - createdAt.getTime() < 7 * DAY_MS);
  const consecutiveBefore = Math.max(0, Number(user.consecutiveInactiveWeeks || 0));
  const consecutiveAfter = newUserProtected ? consecutiveBefore : (completedDeliveryCount > 0 ? 0 : consecutiveBefore + 1);
  const bandBefore = bandForScore(rules, scoreBefore);
  const baseDeduction = newUserProtected ? 0 : bandBefore.weeklyDeduction;
  const inactiveExtraPenaltyApplied = !newUserProtected && consecutiveAfter > 2 ? rules.inactiveExtraPenalty : 0;
  const totalDeduction = baseDeduction + inactiveExtraPenaltyApplied;
  const scoreAfter = Math.max(0, scoreBefore - totalDeduction);
  const bandAfter = bandForScore(rules, scoreAfter);
  return {
    weekKey, periodStart, periodEnd, scoreBefore,
    bandBefore: { min: bandBefore.min, max: bandBefore.max },
    baseDeduction,
    consecutiveInactiveWeeksBefore: consecutiveBefore,
    consecutiveInactiveWeeksAfter: consecutiveAfter,
    inactiveExtraPenaltyApplied,
    totalDeduction,
    scoreAfter,
    bandAfter: { min: bandAfter.min, max: bandAfter.max },
    completedDeliveryCount,
    rewardedDeliveryCount,
    overtimeDeliveryCount,
    oldPostingQuota,
    discardedPostingQuota: oldPostingQuota,
    newPostingQuota: bandAfter.weeklyPostingQuota,
    newUserProtected,
    ruleSnapshot: ruleSnapshot(rules)
  };
}

async function orderCounts(db, tx, userId, periodStart, periodEnd) {
  const _ = db.command;
  const result = await tx.collection('orders').where({
    receiverId: userId,
    status: 'COMPLETED',
    completedAt: _.gte(periodStart).and(_.lt(periodEnd))
  }).limit(1000).get();
  return {
    completedDeliveryCount: result.data.length,
    rewardedDeliveryCount: result.data.filter((order) => order.rewardStatus === 'GRANTED').length,
    overtimeDeliveryCount: result.data.filter((order) => order.deliveryOverdue === true).length
  };
}

async function settleUser(db, userId, options = {}) {
  const now = options.now || new Date();
  const periodEnd = options.periodEnd || shanghaiMonday(now);
  const periodStart = new Date(periodEnd.getTime() - 7 * DAY_MS);
  const weekKey = options.weekKey || isoWeekKey(periodEnd);
  const idempotencyKey = `WEEKLY_QUOTA:${userId}:${weekKey}`;
  return db.runTransaction(async (tx) => {
    const previous = await tx.collection('weeklyQuotaRecords').where({ idempotencyKey }).limit(1).get();
    if (previous.data[0]) return { settled: false, reason: 'ALREADY_SETTLED', userId, weekKey };
    const user = (await tx.collection('users').doc(userId).get()).data;
    if (!user) return { settled: false, reason: 'USER_NOT_FOUND', userId, weekKey };
    if (user.accountStatus !== 'ACTIVE') {
      if (Number(user.postingQuota || 0) !== 0) await tx.collection('users').doc(userId).update({ data: { postingQuota: 0, updatedAt: now } });
      return { settled: false, reason: 'ACCOUNT_DISABLED', userId, weekKey };
    }
    const rules = await loadRules(tx);
    const counts = await orderCounts(db, tx, userId, periodStart, periodEnd);
    const result = computeWeeklySettlement({ user, rules, ...counts, now, periodStart, periodEnd, weekKey });
    await tx.collection('users').doc(userId).update({ data: {
      contributionScore: result.scoreAfter,
      postingQuota: result.newPostingQuota,
      consecutiveInactiveWeeks: result.consecutiveInactiveWeeksAfter,
      updatedAt: now
    } });
    if (result.totalDeduction > 0) {
      await tx.collection('contributionRecords').add({ data: {
        idempotencyKey: `WEEKLY_DEDUCTION:${userId}:${weekKey}`,
        userId,
        changeType: 'WEEKLY_DEDUCTION',
        changeAmount: -result.totalDeduction,
        beforeValue: result.scoreBefore,
        afterValue: result.scoreAfter,
        description: '每周贡献值结算',
        weekKey,
        createdAt: now
      } });
    }
    const added = await tx.collection('weeklyQuotaRecords').add({ data: {
      userId,
      ...result,
      idempotencyKey,
      createdAt: now
    } });
    return { settled: true, reason: 'SETTLED', userId, weekKey, recordId: added._id };
  });
}

async function settleBatch(db, options = {}) {
  const limit = Math.min(PAGE_SIZE, Math.max(1, Number(options.limit) || PAGE_SIZE));
  const offset = Math.max(0, Number(options.offset) || 0);
  const users = await db.collection('users').orderBy('createdAt', 'asc').skip(offset).limit(limit).get();
  const summary = { scanned: users.data.length, settled: 0, skipped: 0, failed: 0, nextOffset: offset + users.data.length, hasMore: users.data.length === limit, errors: [] };
  for (const user of users.data) {
    try {
      const result = await settleUser(db, user._id, options);
      if (result.settled) summary.settled += 1; else summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({ userId: user._id, message: String(error?.message || error?.errMsg || '').slice(0, 160) });
      console.error('weekly settlement failed', { userId: user._id, error });
    }
  }
  return summary;
}

async function recordList({ db, openid, data }) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  const user = assertActive(found.data[0]);
  const page = Math.max(0, Number(data?.page || 0));
  const result = await db.collection('weeklyQuotaRecords').where({ userId: user._id }).orderBy('periodEnd', 'desc').skip(page * PAGE_SIZE).limit(PAGE_SIZE).get();
  return ok({ items: result.data.map((item) => ({ ...item, id: item._id })), page, hasMore: result.data.length === PAGE_SIZE });
}

module.exports = { shanghaiMonday, isoWeekKey, computeWeeklySettlement, settleUser, settleBatch, recordList };
