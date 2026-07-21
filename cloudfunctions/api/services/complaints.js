const { ROLES, assertActive, requireExactRole, requireUserRole } = require('../common/permissions');
const { ok, fail } = require('../common/response');
const { effectiveComplaintDeadline, settleReward, settleEligibleRewardsBatch } = require('./maintenance');

const LEGACY_REWARD = 8;
const LEGACY_PENALTY = 25;

function deadline(order) { return effectiveComplaintDeadline(order); }
function images(value) {
  if (!Array.isArray(value) || value.length > 6 || value.some((item) => typeof item !== 'string' || !item.startsWith('cloud://'))) {
    throw fail('VALIDATION_ERROR', '投诉图片格式不正确');
  }
  return [...new Set(value)];
}
async function user(db, openid) { const result = await db.collection('users').where({ openid }).limit(1).get(); return result.data[0]; }
async function log(tx, orderId, current, operation, detail) {
  return tx.collection('operationLogs').add({ data: { orderId, operatorId: current._id, operatorRole: current.role, operation, detail, createdAt: new Date() } });
}
async function adminScope(db, openid) {
  const admin = requireExactRole(assertActive(await user(db, openid)), ROLES.ADMIN);
  const buildingId = admin.dormSnapshot?.buildingId || admin.dormBuildingId;
  if (!buildingId) throw fail('PROFILE_REQUIRED', '请先完善管理员宿舍资料');
  return { admin, buildingId };
}
async function adminLog(tx, admin, buildingId, orderId, action, beforeSnapshot, afterSnapshot) {
  return tx.collection('operationLogs').add({ data: { orderId, operatorId: admin._id, operatorRole: admin.role,
    operatorBuildingId: buildingId, targetType: 'COMPLAINT', targetId: orderId, targetBuildingId: buildingId,
    action, beforeSnapshot, afterSnapshot, createdAt: new Date() } });
}
function complaintId(data) {
  const raw = data?.complaintId;
  if (raw === undefined || raw === null || !['string', 'number'].includes(typeof raw) || !String(raw).trim()) throw fail('INVALID_COMPLAINT_ID', '投诉信息无效');
  return String(raw).trim();
}

async function submit({ db, openid, data }) {
  const reason = String(data.reason || '').trim();
  if (!reason) throw fail('COMPLAINT_REASON_REQUIRED', '投诉原因不能为空');
  const imageFileIds = images(data.imageFileIds || []);
  return db.runTransaction(async (tx) => {
    const current = requireUserRole(assertActive(await user(tx, openid)));
    const order = (await tx.collection('orders').doc(data.orderId).get()).data;
    if (!order || order.status !== 'COMPLETED') throw fail('ORDER_NOT_COMPLETED', '订单未完成');
    if (order.publisherId !== current._id) throw fail('NOT_ORDER_PUBLISHER', '仅发布者可投诉');
    if (!['FROZEN', 'CANCELED'].includes(order.rewardStatus)) throw fail('REWARD_ALREADY_SETTLED', '贡献值已结算');
    if ((order.complaintStatus && order.complaintStatus !== 'NONE') || order.complaintId) throw fail('COMPLAINT_ALREADY_EXISTS', '已提交投诉');
    if (new Date() >= new Date(deadline(order))) throw fail('COMPLAINT_WINDOW_EXPIRED', '投诉期限已过');
    const duplicate = await tx.collection('complaints').where({ orderId: order._id }).limit(1).get();
    if (duplicate.data[0]) throw fail('COMPLAINT_ALREADY_EXISTS', '已提交投诉');
    const now = new Date();
    const added = await tx.collection('complaints').add({ data: { complaintNo: `CP${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      orderId: order._id, orderBuildingId: order.buildingId, complainantId: current._id, respondentId: order.receiverId,
      reason, imageFileIds, status: 'PENDING', penaltyAmount: Number(order.penaltyAmount ?? LEGACY_PENALTY),
      orderSnapshot: { orderNo: order.orderNo || '', itemName: order.itemName, publisherSnapshot: order.publisherSnapshot,
        receiverSnapshot: order.receiverSnapshot, completedAt: order.completedAt, complaintDeadline: deadline(order) },
      reviewerId: null, reviewerName: '', reviewRemark: '', reviewedAt: null, createdAt: now, updatedAt: now, version: 1 } });
    await tx.collection('orders').doc(order._id).update({ data: { complaintId: added._id, complaintStatus: 'PENDING', updatedAt: now, version: (order.version || 0) + 1 } });
    await log(tx, order._id, current, 'COMPLAINT_SUBMIT', '提交投诉');
    return ok({ complaintId: added._id });
  });
}

async function review({ db, openid, data }) {
  return db.runTransaction(async (tx) => {
    const { admin, buildingId } = await adminScope(tx, openid);
    const complaint = (await tx.collection('complaints').doc(complaintId(data)).get()).data;
    if (!complaint || complaint.status !== 'PENDING') throw fail('COMPLAINT_ALREADY_REVIEWED', '投诉已审核');
    const order = (await tx.collection('orders').doc(complaint.orderId).get()).data;
    if (!order || order.buildingId !== buildingId) throw fail('FORBIDDEN_BUILDING_SCOPE', '无权处理其他宿舍楼的业务');
    if (!['FROZEN', 'CANCELED'].includes(order.rewardStatus) || order.complaintStatus !== 'PENDING') throw fail('REWARD_ALREADY_SETTLED', '订单贡献值已结算');
    const upheld = data.decision === 'UPHELD';
    if (!upheld && data.decision !== 'DISMISSED') throw fail('VALIDATION_ERROR', '审核结果无效');
    const receiver = (await tx.collection('users').doc(order.receiverId).get()).data;
    if (!receiver) throw fail('USER_NOT_FOUND', '接单者不存在');
    const canceledForOvertime = order.rewardStatus === 'CANCELED' || order.rewardEligible === false;
    const beforeValue = Number(receiver.contributionScore ?? 60);
    const penalty = Number(complaint.penaltyAmount ?? order.penaltyAmount ?? LEGACY_PENALTY);
    const reward = Number(order.rewardAmount ?? LEGACY_REWARD);
    const delta = upheld ? -penalty : (canceledForOvertime ? 0 : reward);
    const afterValue = Math.max(0, Math.min(100, beforeValue + delta));
    const now = new Date();
    const status = upheld ? 'UPHELD' : 'DISMISSED';
    const reviewRemark = String(data.reviewRemark || '').trim();
    if (delta !== 0) {
      await tx.collection('users').doc(receiver._id).update({ data: { contributionScore: afterValue, updatedAt: now } });
      await tx.collection('contributionRecords').add({ data: { idempotencyKey: `${upheld ? 'COMPLAINT_PENALTY' : 'ORDER_REWARD'}:${order._id}`,
        userId: receiver._id, changeType: upheld ? 'COMPLAINT_PENALTY' : 'ORDER_REWARD', changeAmount: afterValue - beforeValue,
        beforeValue, afterValue, relatedOrderId: order._id, relatedComplaintId: complaint._id,
        description: upheld ? '订单投诉成立' : '投诉不成立，完成订单贡献值', createdAt: now } });
    }
    const rewardStatus = canceledForOvertime ? 'CANCELED' : (upheld ? 'REJECTED' : 'GRANTED');
    const orderUpdates = { complaintStatus: status, rewardStatus, updatedAt: now, version: (order.version || 0) + 1 };
    if (!canceledForOvertime && upheld) orderUpdates.rewardRejectedAt = now;
    if (!canceledForOvertime && !upheld) orderUpdates.rewardGrantedAt = now;
    await tx.collection('complaints').doc(complaint._id).update({ data: { status, reviewerId: admin._id,
      reviewerName: admin.realName || '', reviewRemark, reviewedAt: now, updatedAt: now, version: (complaint.version || 0) + 1 } });
    await tx.collection('orders').doc(order._id).update({ data: orderUpdates });
    await adminLog(tx, admin, buildingId, order._id, upheld ? 'COMPLAINT_UPHOLD' : 'COMPLAINT_DISMISS',
      { status: 'PENDING', rewardStatus: order.rewardStatus }, { status, rewardStatus, reviewRemark });
    return ok({ complaintId: complaint._id, rewardStatus, contributionChange: afterValue - beforeValue });
  });
}

async function settle(db, orderId) { return (await settleReward(db, orderId)).settled; }
async function settleOrder({ db, openid, data }) {
  const raw = data?.orderId;
  if (raw === undefined || raw === null || !['string', 'number'].includes(typeof raw) || !String(raw).trim()) throw fail('INVALID_ORDER_ID', '订单信息无效');
  const operator = assertActive(await user(db, openid));
  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(operator.role)) throw fail('FORBIDDEN', '权限不足');
  return ok(await settleReward(db, String(raw).trim()));
}
async function settleEligibleBatch(db, options = {}) { return settleEligibleRewardsBatch(db, options); }
async function settleEligibleBatchAction({ db, openid, data }) {
  const operator = assertActive(await user(db, openid));
  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(operator.role)) throw fail('FORBIDDEN', '权限不足');
  return ok(await settleEligibleBatch(db, { limit: data?.limit }));
}
async function mine({ db, openid, data }) {
  const current = assertActive(await user(db, openid)); const page = Math.max(0, Number(data.page || 0));
  const result = await db.collection('complaints').where({ complainantId: current._id }).orderBy('createdAt', 'desc').limit(20).skip(page * 20).get();
  return ok({ items: result.data.map((item) => ({ _id: item._id, id: item._id, orderId: item.orderId,
    orderNo: item.orderSnapshot?.orderNo || '', itemName: item.orderSnapshot?.itemName || '', reason: item.reason,
    status: item.status, createdAt: item.createdAt, reviewedAt: item.reviewedAt,
    respondentName: item.orderSnapshot?.receiverSnapshot?.displayName || '' })), page, hasMore: result.data.length === 20 });
}
async function adminList({ db, openid, data }) {
  const { buildingId } = await adminScope(db, openid); const status = data.status || 'PENDING';
  const page = Math.max(0, Number(data.page || 0)); const size = 20;
  const scoped = await db.collection('complaints').where({ status, orderBuildingId: buildingId }).orderBy('createdAt', 'desc').limit((page + 1) * size + 1).get();
  const legacy = await db.collection('complaints').where({ status }).orderBy('createdAt', 'desc').limit(100).get();
  const merged = new Map(scoped.data.map((item) => [item._id, item]));
  for (const item of legacy.data) {
    if (item.orderBuildingId || merged.has(item._id)) continue;
    const order = (await db.collection('orders').doc(item.orderId).get()).data;
    if (order?.buildingId === buildingId) merged.set(item._id, item);
  }
  const all = [...merged.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return ok({ items: all.slice(page * size, page * size + size).map((item) => ({ ...item, complaintId: item._id })), page, hasMore: all.length > (page + 1) * size });
}
async function detail({ db, openid, data }) {
  const current = assertActive(await user(db, openid)); const id = complaintId(data);
  const complaint = (await db.collection('complaints').doc(id).get()).data;
  if (!complaint || complaint.complainantId !== current._id) throw fail('COMPLAINT_NOT_FOUND', '投诉不存在');
  const order = (await db.collection('orders').doc(complaint.orderId).get()).data;
  return ok({ ...complaint, orderNo: order?.orderNo || complaint.orderSnapshot?.orderNo || '' });
}
async function adminDetail({ db, openid, data }) {
  const { buildingId } = await adminScope(db, openid); const complaint = (await db.collection('complaints').doc(complaintId(data)).get()).data;
  if (!complaint) throw fail('COMPLAINT_NOT_FOUND', '投诉不存在');
  const order = (await db.collection('orders').doc(complaint.orderId).get()).data;
  if (!order || order.buildingId !== buildingId) throw fail('FORBIDDEN_BUILDING_SCOPE', '无权处理其他宿舍楼的业务');
  return ok({ ...complaint, order: { id: order._id, orderNo: order.orderNo || '', itemName: order.itemName || '', status: order.status,
    completedAt: order.completedAt || null, publisherSnapshot: order.publisherSnapshot || {}, receiverSnapshot: order.receiverSnapshot || {} } });
}
async function recordList({ db, openid, data }) {
  const current = assertActive(await user(db, openid)); const page = Math.max(0, Number(data.page || 0));
  const result = await db.collection('contributionRecords').where({ userId: current._id }).orderBy('createdAt', 'desc').limit(20).skip(page * 20).get();
  const orderIds = [...new Set(result.data.map((item) => item.relatedOrderId).filter(Boolean))]; const names = new Map();
  await Promise.all(orderIds.map(async (id) => { try { const order = (await db.collection('orders').doc(id).get()).data; if (order?._id) names.set(id, order.itemName || ''); } catch (_) {} }));
  return ok({ items: result.data.map((item) => ({ ...item, relatedOrderItemName: names.get(item.relatedOrderId) || '' })), page, hasMore: result.data.length === 20 });
}

module.exports = { submit, review, settle, settleOrder, settleEligibleBatch, settleEligibleBatchAction, mine, detail, adminList, adminDetail, recordList };
