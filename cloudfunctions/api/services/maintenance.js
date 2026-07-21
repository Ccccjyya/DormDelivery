const LEGACY_REWARD_AMOUNT = 8;
const COMPLAINT_WINDOW_MS = 6 * 60 * 60 * 1000;
const WAITING_WINDOW_MS = 12 * 60 * 60 * 1000;
const MAX_BATCH_SIZE = 20;

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function effectiveComplaintDeadline(order) {
  return validDate(order?.complaintDeadline)
    || (validDate(order?.completedAt) ? new Date(validDate(order.completedAt).getTime() + COMPLAINT_WINDOW_MS) : null);
}

function effectiveExpiresAt(order) {
  return validDate(order?.expiresAt)
    || (validDate(order?.createdAt) ? new Date(validDate(order.createdAt).getTime() + WAITING_WINDOW_MS) : null);
}

function batchSize(value) {
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Number(value) || MAX_BATCH_SIZE));
}

function errorSummary(error) {
  return String(error?.message || error?.errMsg || 'unknown error').slice(0, 200);
}

async function writeSystemLog(tx, orderId, action, detail, now) {
  await tx.collection('operationLogs').add({ data: {
    orderId,
    operatorId: 'SYSTEM',
    operatorRole: 'SYSTEM',
    targetType: 'ORDER',
    targetId: orderId,
    action,
    detail,
    createdAt: now
  } });
}

async function settleRewardInTransaction(tx, orderId) {
  const order = (await tx.collection('orders').doc(orderId).get()).data;
  if (!order) return { settled: false, reason: 'ORDER_NOT_FOUND', orderId };
  if (order.status !== 'COMPLETED') return { settled: false, reason: 'ORDER_NOT_COMPLETED', orderId };
  if (order.rewardStatus !== 'FROZEN') return { settled: false, reason: 'REWARD_NOT_FROZEN', orderId };
  if ((order.complaintStatus || 'NONE') !== 'NONE') return { settled: false, reason: 'COMPLAINT_EXISTS', orderId };
  if (!order.receiverId) return { settled: false, reason: 'RECEIVER_MISSING', orderId };

  const complaintDeadline = effectiveComplaintDeadline(order);
  if (!complaintDeadline) return { settled: false, reason: 'COMPLAINT_DEADLINE_INVALID', orderId };
  const now = new Date();
  if (now < complaintDeadline) return { settled: false, reason: 'COMPLAINT_WINDOW_OPEN', orderId };

  const complaint = await tx.collection('complaints').where({ orderId }).limit(1).get();
  if (complaint.data[0]) return { settled: false, reason: 'COMPLAINT_RECORD_EXISTS', orderId };
  const idempotencyKey = `ORDER_REWARD:${orderId}`;
  const previousReward = await tx.collection('contributionRecords').where({ idempotencyKey }).limit(1).get();
  if (previousReward.data[0]) return { settled: false, reason: 'REWARD_RECORD_EXISTS', orderId };

  const receiver = (await tx.collection('users').doc(order.receiverId).get()).data;
  if (!receiver) return { settled: false, reason: 'RECEIVER_NOT_FOUND', orderId };
  const beforeValue = Number(receiver.contributionScore ?? 60);
  const rewardAmount = Number(order.rewardAmount ?? LEGACY_REWARD_AMOUNT);
  const afterValue = Math.min(100, beforeValue + rewardAmount);

  await tx.collection('users').doc(receiver._id).update({ data: { contributionScore: afterValue, updatedAt: now } });
  await tx.collection('contributionRecords').add({ data: {
    idempotencyKey,
    userId: receiver._id,
    openid: receiver.openid,
    changeType: 'ORDER_REWARD',
    changeAmount: afterValue - beforeValue,
    beforeValue,
    afterValue,
    relatedOrderId: orderId,
    relatedComplaintId: null,
    description: '完成互助订单且投诉期内无有效投诉',
    createdAt: now
  } });
  await tx.collection('orders').doc(orderId).update({ data: {
    rewardStatus: 'GRANTED',
    rewardGrantedAt: now,
    rewardAmount,
    complaintDeadline,
    updatedAt: now,
    version: (order.version || 0) + 1
  } });
  await writeSystemLog(tx, orderId, 'ORDER_REWARD_GRANTED', '无投诉贡献值自动结算', now);
  return { settled: true, reason: 'SETTLED', orderId };
}

async function settleReward(db, orderId) {
  return db.runTransaction((tx) => settleRewardInTransaction(tx, String(orderId)));
}

async function rewardCandidates(db, limit, now) {
  const _ = db.command;
  const due = await db.collection('orders').where({
    status: 'COMPLETED',
    rewardStatus: 'FROZEN',
    complaintStatus: 'NONE',
    complaintDeadline: _.lte(now)
  }).orderBy('complaintDeadline', 'asc').limit(limit + 1).get();
  const legacy = await db.collection('orders').where({
    status: 'COMPLETED',
    rewardStatus: 'FROZEN',
    complaintStatus: 'NONE',
    complaintDeadline: _.exists(false),
    completedAt: _.lte(new Date(now.getTime() - COMPLAINT_WINDOW_MS))
  }).orderBy('completedAt', 'asc').limit(limit + 1).get();
  const invalidLegacy = await db.collection('orders').where({
    status: 'COMPLETED',
    rewardStatus: 'FROZEN',
    complaintStatus: 'NONE',
    complaintDeadline: _.exists(false),
    completedAt: _.exists(false)
  }).limit(1).get();
  const merged = new Map([...due.data, ...legacy.data, ...invalidLegacy.data].map((order) => [order._id, order]));
  const all = [...merged.values()].sort((a, b) => {
    const left = effectiveComplaintDeadline(a);
    const right = effectiveComplaintDeadline(b);
    if (!left) return 1;
    if (!right) return -1;
    return left - right;
  });
  return { candidates: all.slice(0, limit), hasMore: all.length > limit || due.data.length > limit || legacy.data.length > limit };
}

async function settleEligibleRewardsBatch(db, options = {}) {
  const limit = batchSize(options.limit);
  const { candidates, hasMore } = await rewardCandidates(db, limit, new Date());
  const summary = { scanned: candidates.length, settled: 0, skipped: 0, failed: 0, hasMore, failedOrders: [] };
  for (const order of candidates) {
    try {
      const result = await settleReward(db, order._id);
      if (result.settled) summary.settled += 1;
      else {
        summary.skipped += 1;
        if (result.reason === 'COMPLAINT_DEADLINE_INVALID') {
          console.warn('reward settlement skipped invalid legacy order', { orderId: order._id, reason: result.reason });
        }
      }
    } catch (error) {
      summary.failed += 1;
      summary.failedOrders.push({ orderId: order._id, error: errorSummary(error) });
      console.error('reward settlement item failed', { orderId: order._id, error: errorSummary(error) });
    }
  }
  return summary;
}

async function expireWaitingOrderInTransaction(tx, orderId) {
  const order = (await tx.collection('orders').doc(orderId).get()).data;
  if (!order) return { expired: false, reason: 'ORDER_NOT_FOUND', orderId };
  if (order.status !== 'WAITING') return { expired: false, reason: 'ORDER_NOT_WAITING', orderId };
  if (order.withdrawn === true) return { expired: false, reason: 'ORDER_WITHDRAWN', orderId };
  if (order.receiverId) return { expired: false, reason: 'ORDER_ALREADY_ACCEPTED', orderId };
  const expiresAt = effectiveExpiresAt(order);
  if (!expiresAt) return { expired: false, reason: 'EXPIRES_AT_INVALID', orderId };
  const now = new Date();
  if (now < expiresAt) return { expired: false, reason: 'NOT_EXPIRED', orderId };

  await tx.collection('orders').doc(orderId).update({ data: {
    status: 'EXPIRED',
    expiresAt,
    expiredAt: now,
    updatedAt: now,
    version: (order.version || 0) + 1
  } });
  await writeSystemLog(tx, orderId, 'ORDER_AUTO_EXPIRED', '待接订单发布满12小时自动失效', now);
  return { expired: true, reason: 'EXPIRED', orderId };
}

async function expireWaitingOrder(db, orderId) {
  return db.runTransaction((tx) => expireWaitingOrderInTransaction(tx, String(orderId)));
}

async function expirationCandidates(db, limit, now) {
  const _ = db.command;
  const due = await db.collection('orders').where({
    status: 'WAITING',
    withdrawn: false,
    expiresAt: _.lte(now)
  }).orderBy('expiresAt', 'asc').limit(limit + 1).get();
  const legacy = await db.collection('orders').where({
    status: 'WAITING',
    expiresAt: _.exists(false),
    createdAt: _.lte(new Date(now.getTime() - WAITING_WINDOW_MS))
  }).orderBy('createdAt', 'asc').limit(limit + 1).get();
  const merged = new Map([...due.data, ...legacy.data.filter((order) => order.withdrawn !== true)].map((order) => [order._id, order]));
  const all = [...merged.values()].sort((a, b) => effectiveExpiresAt(a) - effectiveExpiresAt(b));
  return { candidates: all.slice(0, limit), hasMore: all.length > limit || due.data.length > limit || legacy.data.length > limit };
}

async function expireEligibleOrdersBatch(db, options = {}) {
  const limit = batchSize(options.limit);
  const { candidates, hasMore } = await expirationCandidates(db, limit, new Date());
  const summary = { scanned: candidates.length, expired: 0, skipped: 0, failed: 0, hasMore, failedOrders: [] };
  for (const order of candidates) {
    try {
      const result = await expireWaitingOrder(db, order._id);
      if (result.expired) summary.expired += 1;
      else summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      summary.failedOrders.push({ orderId: order._id, error: errorSummary(error) });
      console.error('order expiration item failed', { orderId: order._id, error: errorSummary(error) });
    }
  }
  return summary;
}

module.exports = {
  effectiveComplaintDeadline,
  effectiveExpiresAt,
  settleReward,
  settleEligibleRewardsBatch,
  expireWaitingOrderInTransaction,
  expireWaitingOrder,
  expireEligibleOrdersBatch
};
