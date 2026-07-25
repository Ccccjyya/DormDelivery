const { ROLES, assertActive, requireExactRole, requireUserRole } = require('../common/permissions');
const { ok, fail } = require('../common/response');
const { effectiveExpiresAt, expireWaitingOrderInTransaction, expireWaitingOrder, expireEligibleOrdersBatch } = require('./maintenance');
const { generateOrderNo, createWithOrderNoRetry, auditOrderNumbers } = require('./orderNumber');
const { loadRules } = require('./businessRules');

const WAITING_HOURS = 12;
const PAGE_SIZE = 20;

function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw fail('VALIDATION_ERROR', `${name}必须为${min}到${max}的整数`);
  return value;
}

function deliveryOutcome(order, completedAt) {
  const acceptedAt = order.acceptedAt ? new Date(order.acceptedAt) : null;
  const policyApplies = Boolean(order.rewardPolicyVersion && acceptedAt && Number.isFinite(acceptedAt.getTime()));
  const deliveryDurationSeconds = policyApplies ? Math.max(0, Math.floor((completedAt.getTime() - acceptedAt.getTime()) / 1000)) : null;
  const deliveryOverdue = policyApplies ? completedAt.getTime() - acceptedAt.getTime() > 10 * 60 * 1000 : false;
  return { policyApplies, deliveryDurationSeconds, deliveryOverdue };
}

function requireProfile(user) {
  requireUserRole(user);
  if (!user.profileCompleted || !user.dormSnapshot?.buildingId || !user.dormSnapshot?.roomId) {
    throw fail('PROFILE_REQUIRED', '请先完善宿舍资料');
  }
  return user;
}

function snapshot(user) {
  const dorm = user.dormSnapshot;
  return { userId: user._id, displayName: user.realName || '', buildingId: dorm.buildingId, buildingNo: dorm.buildingNo,
    buildingName: dorm.buildingName, roomId: dorm.roomId, floorNo: dorm.floorNo, doorplateNo: dorm.doorplateNo,
    roomNo: dorm.roomNo, fullRoomLabel: dorm.fullRoomLabel };
}

function cleanText(value, field, max) {
  const text = String(value || '').trim();
  if (!text) throw fail('VALIDATION_ERROR', `请填写${field}`);
  if (text.length > max) throw fail('VALIDATION_ERROR', `${field}格式不正确`);
  return text;
}

function imageIds(value) {
  if (!Array.isArray(value) || value.length > 6 || value.some((id) => typeof id !== 'string' || !id.startsWith('cloud://'))) {
    throw fail('VALIDATION_ERROR', '订单图片格式不正确');
  }
  return [...new Set(value)];
}

function publicOrder(order) {
  if (!order) return null;
  return { id: order._id, orderNo: order.orderNo, orderType: order.orderType || 'takeout', publisherId: order.publisherId, receiverId: order.receiverId,
    status: order.status, itemName: order.itemName, pickupAddress: order.pickupAddress, timeLimitMinutes: order.timeLimitMinutes,
    orderDetail: order.orderDetail || '', pickupMode: order.pickupMode || 'dorm', destinationLabel: order.destinationLabel || '',
    remark: order.remark || '', imageFileIds: order.imageFileIds || [], buildingId: order.buildingId, floorNo: order.floorNo,
    roomId: order.roomId, publisherSnapshot: order.publisherSnapshot, receiverSnapshot: order.receiverSnapshot || null,
    createdAt: order.createdAt, acceptedAt: order.acceptedAt || null, deliveryDeadline: order.deliveryDeadline || null,
    expiresAt: order.expiresAt || null, completedAt: order.completedAt || null, expiredAt: order.expiredAt || null, overdue: Boolean(order.overdue),
    rewardStatus: order.rewardStatus || 'NONE', rewardAmount: order.rewardAmount ?? null,
    rewardGrantedAt: order.rewardGrantedAt || null, rewardRejectedAt: order.rewardRejectedAt || null,
    complaintStatus: order.complaintStatus || 'NONE', complaintDeadline: order.complaintDeadline || null,
    deliveryDurationSeconds: order.deliveryDurationSeconds ?? null, deliveryOverdue: Boolean(order.deliveryOverdue),
    rewardEligible: order.rewardEligible ?? null, rewardCancelReason: order.rewardCancelReason || null,
    rewardCanceledAt: order.rewardCanceledAt || null, rewardPolicyVersion: order.rewardPolicyVersion || null,
    everAccepted: order.everAccepted === true || Boolean(order.receiverId || order.acceptedAt),
    offShelfType: order.offShelfType || (order.withdrawn === true ? 'LEGACY_MANUAL_OFFSHELF' : 'NONE'),
    offShelfAt: order.offShelfAt || order.withdrawnAt || null,
    withdrawn: Boolean(order.withdrawn), withdrawnAt: order.withdrawnAt || null };
}

async function getUser(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

async function log(tx, orderId, user, operation, detail) {
  await tx.collection('operationLogs').add({ data: { orderId, operatorId: user._id, operatorOpenid: user.openid, operation, detail, createdAt: new Date() } });
}

async function expireIfNeeded(db, order) {
  const now = new Date();
  const expiresAt = effectiveExpiresAt(order);
  if (order.status === 'WAITING' && order.withdrawn !== true && expiresAt && expiresAt <= now) {
    const result = await expireWaitingOrder(db, order._id);
    if (result.expired) {
      order.status = 'EXPIRED'; order.expiresAt = expiresAt; order.expiredAt = now;
    }
  }
  if (order.status === 'DELIVERING' && order.deliveryDeadline && new Date(order.deliveryDeadline) < now && !order.overdue) {
    await db.collection('orders').doc(order._id).update({ data: { overdue: true, updatedAt: now } });
    order.overdue = true;
  }
  return order;
}

async function create({ db, openid, data }) {
  if (!String(data.itemName || '').trim()) return fail('VALIDATION_ERROR', '请填写物品信息');
  const clientRequestId = cleanText(data.clientRequestId, '请求标识', 80);
  const itemName = cleanText(data.itemName, '物品信息', 100);
  const pickupAddress = '';
  const timeLimitMinutes = [10, 20, 30, 60, 120, 720].includes(Number(data.timeLimitMinutes)) ? Number(data.timeLimitMinutes) : 720;
  const remark = data.remark ? cleanText(data.remark, '备注', 500) : '';
  const orderType = ['takeout', 'package', 'grocery', 'printing'].includes(data.orderType) ? data.orderType : 'takeout';
  const orderDetail = data.orderDetail ? cleanText(data.orderDetail, '外卖信息', 300) : '';
  const pickupMode = ['dorm', 'station'].includes(data.pickupMode) ? data.pickupMode : 'dorm';
  const destinationLabel = data.destinationLabel ? cleanText(data.destinationLabel, '送达地址', 200) : '';
  const imageFileIds = imageIds(data.imageFileIds || []);
  const rules = await loadRules(db);
  const contributionReward = integer(Number(data.contributionReward || rules.contributionRewardDefault), rules.contributionRewardMin, rules.contributionRewardMax, '贡献值投入');
  const initialUser = await getUser(db, openid); requireProfile(assertActive(initialUser));
  if (initialUser.publishBlocked === true) return fail('PUBLISH_BLOCKED', '已被禁止发单');
  const existing = await db.collection('orders').where({ publisherId: initialUser._id, clientRequestId }).limit(1).get();
  if (existing.data[0]) return ok({ orderId: existing.data[0]._id, duplicate: true });
  return createWithOrderNoRetry({
    findExisting: async () => {
      const duplicate = await db.collection('orders').where({ publisherId: initialUser._id, clientRequestId }).limit(1).get();
      return duplicate.data[0] ? ok({ orderId: duplicate.data[0]._id, duplicate: true }) : null;
    },
    attemptCreate: (orderNo) => db.runTransaction(async (tx) => {
    const user = await getUser(tx, openid); requireProfile(assertActive(user));
    if (user.publishBlocked === true) { const error = new Error('已被禁止发单'); error.code = 'PUBLISH_BLOCKED'; throw error; }
    const duplicate = await tx.collection('orders').where({ publisherId: user._id, clientRequestId }).limit(1).get();
    if (duplicate.data[0]) return ok({ orderId: duplicate.data[0]._id, duplicate: true });
    const beforeScore = Number(user.contributionScore ?? rules.initialContributionScore);
    if (beforeScore < contributionReward) { const error = new Error('贡献值不足'); error.code = 'INSUFFICIENT_SCORE'; throw error; }
    const now = new Date();
    const afterScore = beforeScore - contributionReward;
    const order = { orderNo, clientRequestId, orderType, orderDetail, pickupMode, destinationLabel,
      publisherId: user._id, publisherOpenid: user.openid, receiverId: null, receiverOpenid: null, status: 'WAITING', itemName,
      pickupAddress, timeLimitMinutes, remark, imageFileIds, buildingId: user.dormSnapshot.buildingId, floorNo: user.dormSnapshot.floorNo,
      roomId: user.dormSnapshot.roomId, publisherSnapshot: snapshot(user), receiverSnapshot: {}, createdAt: now, updatedAt: now,
      expiresAt: new Date(now.getTime() + timeLimitMinutes * 60000), acceptedAt: null, deliveryDeadline: null, completedAt: null,
      expiredAt: null, overdue: false, deliveryOverdue: false, rewardEligible: null, rewardStatus: 'NONE',
      rewardAmount: contributionReward, penaltyAmount: rules.upheldComplaintPenalty, rewardPolicyVersion: rules.version,
      everAccepted: false, offShelfType: 'NONE', offShelfAt: null, offShelfBy: null, offShelfByRole: null,
      withdrawn: false, withdrawnAt: null, withdrawnReason: null, version: 1 };
    const added = await tx.collection('orders').add({ data: order });
    await tx.collection('users').doc(user._id).update({ data: { contributionScore: afterScore, updatedAt: now } });
    await tx.collection('contributionRecords').add({ data: { userId: user._id, openid: user.openid, changeType: 'ORDER_PUBLISH',
      changeAmount: -contributionReward, beforeValue: beforeScore, afterValue: afterScore, relatedOrderId: added._id,
      idempotencyKey: `publish-${added._id}`, note: '发单消耗贡献值', createdAt: now } });
    await log(tx, added._id, user, 'CREATE', `发布订单，消耗${contributionReward}贡献值`);
    return ok({ orderId: added._id, duplicate: false, contributionReward, afterScore });
    }),
    generate: generateOrderNo
  });
}

async function available({ db, openid, data }) {
  const user = requireProfile(assertActive(await getUser(db, openid)));
  const mode = data.filterMode || 'MY_FLOOR';
  const condition = { status: 'WAITING', withdrawn: false, buildingId: user.dormSnapshot.buildingId };
  if (mode === 'MY_FLOOR') condition.floorNo = user.dormSnapshot.floorNo;
  else if (mode === 'SPECIFIC_FLOOR') { const floorNo = Number(data.selectedFloorNo); if (!Number.isInteger(floorNo) || floorNo < 1 || floorNo > 11) throw fail('VALIDATION_ERROR', '楼层无效'); condition.floorNo = floorNo; }
  else if (mode !== 'ALL_FLOORS') throw fail('VALIDATION_ERROR', '筛选方式无效');
  const page = Math.max(0, Number(data.page || 0));
  const result = await db.collection('orders').where(condition).orderBy('createdAt', 'desc').limit(PAGE_SIZE).skip(page * PAGE_SIZE).get();
  const items = [];
  for (const order of result.data) { await expireIfNeeded(db, order); if (order.status === 'WAITING' && order.publisherId !== user._id) items.push(publicOrder(order)); }
  return ok({ items, page, hasMore: result.data.length === PAGE_SIZE });
}

async function detail({ db, openid, data }) {
  const user = requireProfile(assertActive(await getUser(db, openid)));
  const order = (await db.collection('orders').doc(data.orderId).get()).data;
  if (!order || order.buildingId !== user.dormSnapshot.buildingId) throw fail('NOT_FOUND', '订单不存在');
  await expireIfNeeded(db, order);
  const complaintDeadline = order.complaintDeadline || (order.completedAt ? new Date(new Date(order.completedAt).getTime() + 6 * 3600000) : null);
  const canComplain = order.publisherId === user._id && order.status === 'COMPLETED' && ['FROZEN', 'CANCELED'].includes(order.rewardStatus)
    && (order.complaintStatus || 'NONE') === 'NONE' && complaintDeadline && new Date() < new Date(complaintDeadline);
  return ok({ ...publicOrder(order), complaintDeadline, canComplain });
}

async function accept({ db, openid, data }) {
  return db.runTransaction(async (tx) => {
    const user = requireProfile(assertActive(await getUser(tx, openid)));
    if (user.acceptBlocked === true) return fail('ACCEPT_BLOCKED', '已被禁止接单');
    const order = (await tx.collection('orders').doc(data.orderId).get()).data;
    if (!order) return fail('ORDER_EXPIRED', '订单已失效');
    if (order.withdrawn || order.status === 'EXPIRED') return fail('ORDER_EXPIRED', '订单已失效');
    if (order.status === 'DELIVERING') return fail('ORDER_DELIVERING', '订单正在配送中');
    if (order.status === 'COMPLETED') return fail('ORDER_COMPLETED', '订单已完成');
    const expiresAt = effectiveExpiresAt(order);
    if (!expiresAt || expiresAt <= new Date()) {
      if (expiresAt) await expireWaitingOrderInTransaction(tx, order._id);
      return fail('ORDER_EXPIRED', '订单已失效');
    }
    if (order.status !== 'WAITING') return fail('ORDER_UNAVAILABLE', '订单当前不可接取');
    if (order.publisherId === user._id || order.buildingId !== user.dormSnapshot.buildingId) return fail('FORBIDDEN', '不能接取该订单');
    const now = new Date();
    const rules = await loadRules(tx);
    const receiverSnapshot = snapshot(user);
    await tx.collection('orders').doc(order._id).update({ data: { receiverId: user._id, receiverOpenid: user.openid,
      receiverSnapshot: db.command.set(receiverSnapshot),
      status: 'DELIVERING', everAccepted: true, acceptedAt: now,
      rewardPolicyVersion: rules.version, deliveryDeadline: new Date(now.getTime() + order.timeLimitMinutes * 60000),
      updatedAt: now, version: (order.version || 0) + 1 } });
    await log(tx, order._id, user, 'ACCEPT', '接取订单'); return ok({ orderId: order._id });
  });
}

async function complete({ db, openid, data }) {
  return db.runTransaction(async (tx) => {
    const user = requireProfile(assertActive(await getUser(tx, openid)));
    const order = (await tx.collection('orders').doc(data.orderId).get()).data;
    if (!order || order.withdrawn || order.status === 'EXPIRED') return fail('ORDER_EXPIRED', '订单已失效');
    if (order.status === 'COMPLETED') return fail('ORDER_COMPLETED', '订单已完成');
    if (order.status === 'WAITING') return fail('ORDER_WAITING', '订单尚未接取');
    if (order.status !== 'DELIVERING') return fail('ORDER_UNAVAILABLE', '订单当前不可完成');
    if (order.receiverId !== user._id) return fail('FORBIDDEN', '只有接单者可以完成配送');
    const now = new Date();
    const rules = await loadRules(tx);
    const { deliveryOverdue } = deliveryOutcome(order, now);
    const rewardAmount = Number(order.rewardAmount ?? rules.contributionRewardDefault);
    const rewardStatus = deliveryOverdue ? 'CANCELED' : 'FROZEN';

    // 只有不超时的情况下才冻结贡献值、后续转给接单人；超时则取消并退回发布者
    if (!deliveryOverdue) {
      const publisher = await getUser(tx, order.publisherOpenid);
      if (publisher) {
        // 冻结期间不操作分数，由 scheduledMaintenance 结算投诉期满后再转
      }
    }

    await tx.collection('orders').doc(order._id).update({ data: { status: 'COMPLETED', completedAt: now,
      complaintDeadline: new Date(now.getTime() + 6 * 3600000), complaintStatus: 'NONE', rewardAmount,
      penaltyAmount: rules.upheldComplaintPenalty, deliveryDurationSeconds: null, deliveryOverdue, overdue: deliveryOverdue,
      rewardEligible: !deliveryOverdue, rewardStatus, rewardCancelReason: deliveryOverdue ? 'DELIVERY_OVERTIME' : null,
      rewardCanceledAt: deliveryOverdue ? now : null, updatedAt: now, version: (order.version || 0) + 1 } });
    await log(tx, order._id, user, 'COMPLETE', deliveryOverdue ? '完成配送，超时取消贡献值' : `完成配送，${rewardAmount}贡献值待结算`);
    return ok({ orderId: order._id, deliveryOverdue, rewardStatus, rewardAmount });
  });
}

async function withdraw({ db, openid, data }) {
  return db.runTransaction(async (tx) => {
    const user = requireProfile(assertActive(await getUser(tx, openid)));
    const order = (await tx.collection('orders').doc(data.orderId).get()).data;
    if (!order || order.publisherId !== user._id) return fail('FORBIDDEN', '只能下架自己的订单');
    if (order.withdrawn || order.status === 'EXPIRED') return fail('ORDER_EXPIRED', '订单已失效');
    if (order.status === 'DELIVERING') return fail('ORDER_DELIVERING', '订单正在配送中');
    if (order.status === 'COMPLETED') return fail('ORDER_COMPLETED', '订单已完成');
    if (order.status === 'WAITING' && new Date(order.expiresAt) <= new Date()) return fail('ORDER_EXPIRED', '订单已失效');
    if (order.status !== 'WAITING') return fail('ORDER_UNAVAILABLE', '订单当前不可下架');
    const now = new Date();

    // 返还贡献值
    const rules = await loadRules(tx);
    const refundAmount = Number(order.rewardAmount ?? rules.contributionRewardDefault);
    if (refundAmount > 0) {
      const publisher = await getUser(tx, order.publisherOpenid);
      if (publisher) {
        const beforeScore = Number(publisher.contributionScore ?? rules.initialContributionScore);
        const afterScore = beforeScore + refundAmount;
        await tx.collection('users').doc(publisher._id).update({ data: { contributionScore: afterScore, updatedAt: now } });
        await tx.collection('contributionRecords').add({ data: { userId: publisher._id, openid: publisher.openid, changeType: 'ORDER_REFUND', changeAmount: refundAmount, beforeValue: beforeScore, afterValue: afterScore, relatedOrderId: order._id, idempotencyKey: `refund-${order._id}`, note: '下架订单返还贡献值', createdAt: now } });
      }
    }

    await tx.collection('orders').doc(order._id).update({ data: { withdrawn: true, withdrawnAt: now,
      withdrawnReason: 'PUBLISHER', offShelfType: 'PUBLISHER_WITHDRAW', offShelfAt: now, offShelfBy: user._id,
      offShelfByRole: user.role, updatedAt: now, version: (order.version || 0) + 1 } });
    await log(tx, order._id, user, 'WITHDRAW', `发布者下架订单，返还${refundAmount}贡献值`); return ok({ orderId: order._id, refundedAmount: refundAmount });
  });
}

async function mine({ db, openid, type, data }) {
  const user = requireProfile(assertActive(await getUser(db, openid))); const page = Math.max(0, Number(data.page || 0));
  const key = type === 'PUBLISHED' ? 'publisherId' : 'receiverId'; const result = await db.collection('orders').where({ [key]: user._id }).orderBy('createdAt', 'desc').limit(PAGE_SIZE).skip(page * PAGE_SIZE).get();
  const items = []; for (const order of result.data) { await expireIfNeeded(db, order); items.push(publicOrder(order)); }
  return ok({ items, page, hasMore: result.data.length === PAGE_SIZE });
}

async function expireEligibleBatchAction({ db, openid, data }) {
  const operator = assertActive(await getUser(db, openid));
  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(operator.role)) throw fail('FORBIDDEN', '权限不足');
  return ok(await expireEligibleOrdersBatch(db, { limit: data?.limit }));
}

async function auditOrderNumbersAction({ db, openid, data }) {
  requireExactRole(assertActive(await getUser(db, openid)), ROLES.SUPER_ADMIN);
  return ok(await auditOrderNumbers(db, { maxDocuments: data?.maxDocuments }));
}

module.exports = { create, available, detail, accept, complete, withdraw, mine, expireEligibleBatchAction, auditOrderNumbersAction, deliveryOutcome };
