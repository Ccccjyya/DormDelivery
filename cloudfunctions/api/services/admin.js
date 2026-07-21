const { assertActive, requireExactRole, ROLES } = require('../common/permissions');
const { ok, fail } = require('../common/response');

const PAGE_SIZE = 20;

async function currentAdmin(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  const admin = requireExactRole(assertActive(result.data[0]), ROLES.ADMIN);
  const buildingId = admin.dormSnapshot?.buildingId || admin.dormBuildingId;
  if (!buildingId) throw fail('PROFILE_REQUIRED', '请先完善管理员宿舍资料');
  return { admin, buildingId };
}

async function targetUser(db, userId, buildingId) {
  if (!userId || typeof userId !== 'string') throw fail('VALIDATION_ERROR', '用户信息无效');
  const target = (await db.collection('users').doc(userId).get()).data;
  if (!target) throw fail('USER_NOT_FOUND', '用户不存在');
  if (target.role === ROLES.SUPER_ADMIN) throw fail('FORBIDDEN', '无权查看超级管理员资料');
  const targetBuildingId = target.dormSnapshot?.buildingId || target.dormBuildingId;
  if (targetBuildingId !== buildingId) throw fail('FORBIDDEN_BUILDING_SCOPE', '只能操作同楼学生信息');
  return target;
}

async function writeLog(db, admin, buildingId, targetType, targetId, action, beforeData, afterData, reason) {
  await db.collection('operationLogs').add({ data: {
    operatorId: admin._id, operatorRole: admin.role, operatorBuildingId: buildingId,
    targetType, targetId, targetBuildingId: buildingId, action, beforeData, afterData,
    reason: String(reason || '').trim(), createdAt: new Date()
  }});
}

function clientUser(user) {
  const dorm = user.dormSnapshot || {};
  return { id: user._id, realName: user.realName || '', studentNo: user.studentNo || '',
    role: user.role,
    accountStatus: user.accountStatus, publishBlocked: user.publishBlocked === true, acceptBlocked: user.acceptBlocked === true,
    publishBlockedReason: user.publishBlockedReason || '', acceptBlockedReason: user.acceptBlockedReason || '',
    profileStatus: user.profileStatus || 'APPROVED', locks: user.locks || {}, dormBuildingId: user.dormBuildingId || dorm.buildingId,
    dormRoomId: user.dormRoomId || dorm.roomId, dormSnapshot: dorm, contributionScore: user.contributionScore ?? 60,
    postingQuota: user.postingQuota ?? 0, createdAt: user.createdAt };
}

function validId(value, code, message) {
  if (!['string', 'number'].includes(typeof value) || !String(value).trim()) throw fail(code, message);
  return String(value).trim();
}

async function userList({ db, openid, data }) {
  const { buildingId } = await currentAdmin(db, openid);
  const page = Math.max(0, Number(data?.page || 0));
  const keyword = String(data?.keyword || '').trim().toLowerCase();
  const floorNo = data?.floorNo === undefined || data.floorNo === null || data.floorNo === '' ? null : Number(data.floorNo);
  const profileStatus = ['PENDING', 'APPROVED'].includes(data?.profileStatus) ? data.profileStatus : '';
  const all = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const result = await db.collection('users').where({ dormBuildingId: buildingId }).orderBy('createdAt', 'desc').limit(100).skip(offset).get();
    all.push(...result.data);
    if (result.data.length < 100) break;
  }
  const filtered = all.filter((user) => {
    const dorm = user.dormSnapshot || {};
    const matchesKeyword = !keyword || String(user.realName || '').toLowerCase().includes(keyword) || String(user.studentNo || '').toLowerCase().includes(keyword);
    return user.role !== ROLES.SUPER_ADMIN && matchesKeyword
      && (floorNo === null || Number(dorm.floorNo) === floorNo)
      && (!profileStatus || (user.profileStatus || 'APPROVED') === profileStatus);
  });
  const items = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(clientUser);
  return ok({ items, page, hasMore: filtered.length > (page + 1) * PAGE_SIZE });
}

async function userDetail({ db, openid, data }) {
  const { buildingId } = await currentAdmin(db, openid);
  return ok(clientUser(await targetUser(db, validId(data?.userId, 'INVALID_USER_ID', '用户信息无效'), buildingId)));
}

async function updateUserProfile({ db, openid, data }) {
  const { admin, buildingId } = await currentAdmin(db, openid);
  const target = await targetUser(db, data?.userId, buildingId);
  const destinationBuildingId = String(data?.dormBuildingId || target.dormSnapshot?.buildingId || target.dormBuildingId || '').trim();
  const realName = String(data?.realName || '').trim();
  const studentNo = String(data?.studentNo || '').trim();
  const roomId = String(data?.dormRoomId || '').trim();
  const floorNo = Number(data?.floorNo);
  if (!realName || !studentNo || !destinationBuildingId || !roomId || !Number.isInteger(floorNo)) throw fail('VALIDATION_ERROR', '请完整填写资料');
  if (target._id === admin._id && destinationBuildingId !== buildingId) throw fail('ADMIN_BUILDING_LOCKED', '管理员不能直接修改自己的宿舍楼，请先由超级管理员取消管理员身份');
  const roomResult = await db.collection('dormRooms').where({ roomId, buildingId: destinationBuildingId, floorNo, enabled: true }).limit(1).get();
  const room = roomResult.data[0];
  const buildingResult = await db.collection('dormBuildings').where({ buildingId: destinationBuildingId, enabled: true }).limit(1).get();
  const building = buildingResult.data[0];
  if (!room || !building) throw fail('DORM_NOT_FOUND', '宿舍信息无效');
  const dormSnapshot = { buildingId: destinationBuildingId, buildingNo: building.buildingNo, buildingName: building.buildingName, roomId: room.roomId,
    floorNo: room.floorNo, doorplateNo: room.doorplateNo, roomNo: room.roomNo, fullRoomLabel: `${building.buildingName} ${room.floorNo}层 ${room.roomNo}室` };
  const locks = data?.locks && typeof data.locks === 'object' ? data.locks : (target.locks || {});
  const updates = { realName, studentNo, dormBuildingId: destinationBuildingId,
    dormRoomId: room.roomId, dormSnapshot: db.command.set(dormSnapshot), profileCompleted: true,
    locks: db.command.set(locks), updatedAt: new Date() };
  await db.collection('users').doc(target._id).update({ data: updates });
  await writeLog(db, admin, buildingId, 'USER', target._id, 'ADMIN_UPDATE_USER_PROFILE', clientUser(target), { realName, studentNo, dormSnapshot, locks }, '');
  return ok(clientUser({ ...target, ...updates, locks, dormSnapshot }));
}

async function setBusinessRestrictions({ db, openid, data }) {
  const { admin, buildingId } = await currentAdmin(db, openid);
  const target = await targetUser(db, data?.userId, buildingId);
  const type = data?.type;
  const blocked = data?.blocked === true;
  if (!['PUBLISH', 'ACCEPT', 'BOTH'].includes(type)) throw fail('VALIDATION_ERROR', '权限类型无效');
  if (type === 'BOTH') {
    const now = new Date();
    const updates = { publishBlocked: blocked, acceptBlocked: blocked, publishBlockedReason: '', acceptBlockedReason: '',
      publishBlockedAt: now, acceptBlockedAt: now, publishBlockedBy: admin._id, acceptBlockedBy: admin._id, updatedAt: now };
    await db.collection('users').doc(target._id).update({ data: updates });
    await writeLog(db, admin, buildingId, 'USER', target._id, blocked ? 'ADMIN_BLOCK_BUSINESS' : 'ADMIN_RESTORE_BUSINESS',
      { realName: target.realName || '', studentNo: target.studentNo || '', publishBlocked: target.publishBlocked === true, acceptBlocked: target.acceptBlocked === true },
      { realName: target.realName || '', studentNo: target.studentNo || '', publishBlocked: blocked, acceptBlocked: blocked }, '');
    return ok({ userId: target._id, type, blocked });
  }
  const isPublish = type === 'PUBLISH'; const prefix = isPublish ? 'publish' : 'accept';
  const updates = { [`${prefix}Blocked`]: blocked, [`${prefix}BlockedReason`]: '', [`${prefix}BlockedAt`]: new Date(), [`${prefix}BlockedBy`]: admin._id, updatedAt: new Date() };
  await db.collection('users').doc(target._id).update({ data: updates });
  await writeLog(db, admin, buildingId, 'USER', target._id, blocked ? `ADMIN_BLOCK_${type}` : `ADMIN_RESTORE_${type}`,
    { realName: target.realName || '', studentNo: target.studentNo || '', blocked: target[`${prefix}Blocked`] === true },
    { realName: target.realName || '', studentNo: target.studentNo || '', blocked }, '');
  return ok({ userId: target._id, type, blocked });
}

async function invalidateOrder({ db, openid, data }) {
  const orderId = validId(data?.orderId, 'INVALID_ORDER_ID', '订单信息无效');
  return db.runTransaction(async (tx) => {
    const { admin, buildingId } = await currentAdmin(tx, openid);
    const order = (await tx.collection('orders').doc(orderId).get()).data;
    if (!order || order.buildingId !== buildingId) return fail('FORBIDDEN_BUILDING_SCOPE', '无权处理其他宿舍楼的业务');
    if (order.withdrawn || order.status === 'EXPIRED') return fail('ORDER_EXPIRED', '订单已失效');
    if (order.status === 'DELIVERING') return fail('ORDER_DELIVERING', '订单正在配送中');
    if (order.status === 'COMPLETED') return fail('ORDER_COMPLETED', '订单已完成');
    if (order.status === 'WAITING' && new Date(order.expiresAt) <= new Date()) return fail('ORDER_EXPIRED', '订单已失效');
    if (order.status !== 'WAITING') return fail('ORDER_UNAVAILABLE', '订单当前不可下架');
    const now = new Date();
    await tx.collection('orders').doc(orderId).update({ data: { status: 'EXPIRED', withdrawn: true, withdrawnAt: now,
      withdrawnReason: 'ADMIN', offShelfType: 'ADMIN_REMOVE', offShelfAt: now, offShelfBy: admin._id,
      offShelfByRole: 'ADMIN', expiredAt: now, updatedAt: now, version: (order.version || 0) + 1 } });
    await writeLog(tx, admin, buildingId, 'ORDER', orderId, 'ADMIN_INVALIDATE_ORDER',
      { status: order.status, withdrawn: Boolean(order.withdrawn) }, { status: 'EXPIRED', withdrawn: true, offShelfType: 'ADMIN_REMOVE' }, '');
    return ok({ orderId, status: 'EXPIRED' });
  });
}

function periodStartFor(value, now) {
  if (value === 'ALL') return null;
  if (value === 'WEEK') {
    const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const day = shifted.getUTCDay() || 7;
    shifted.setUTCHours(0, 0, 0, 0);
    shifted.setUTCDate(shifted.getUTCDate() - day + 1);
    return new Date(shifted.getTime() - 8 * 60 * 60 * 1000);
  }
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

function inferredEverAccepted(order) {
  return order.everAccepted === true || Boolean(order.receiverId || order.acceptedAt || ['DELIVERING', 'COMPLETED'].includes(order.status));
}

function inferredOffShelfType(order) {
  if (order.offShelfType) return order.offShelfType;
  if (order.withdrawn === true) return 'LEGACY_MANUAL_OFFSHELF';
  return 'NONE';
}

function calculateAcceptanceStats(orders, now = new Date()) {
  let acceptedCount = 0; let naturallyExpiredUnacceptedCount = 0; let manuallyExcludedCount = 0; let currentWaitingExcludedCount = 0;
  for (const order of orders) {
    const accepted = inferredEverAccepted(order);
    const offShelfType = inferredOffShelfType(order);
    if (offShelfType !== 'NONE') { manuallyExcludedCount += 1; continue; }
    if (accepted) { acceptedCount += 1; continue; }
    const expiresAt = order.expiresAt ? new Date(order.expiresAt) : new Date(new Date(order.createdAt).getTime() + 12 * 60 * 60 * 1000);
    if (order.status === 'EXPIRED' || expiresAt <= now) naturallyExpiredUnacceptedCount += 1;
    else currentWaitingExcludedCount += 1;
  }
  const nonOffShelfOrderCount = acceptedCount + naturallyExpiredUnacceptedCount + currentWaitingExcludedCount;
  return { eligibleOrderCount: nonOffShelfOrderCount, nonOffShelfOrderCount, acceptedCount,
    naturallyExpiredUnacceptedCount, manuallyExcludedCount, currentWaitingExcludedCount,
    acceptanceRate: nonOffShelfOrderCount ? Math.round(acceptedCount * 100 / nonOffShelfOrderCount) : null };
}

async function operationLogList({ db, openid, data }) {
  const { admin, buildingId } = await currentAdmin(db, openid);
  const page = Math.max(0, Number(data?.page || 0));
  const result = await db.collection('operationLogs').where({ operatorId: admin._id, targetBuildingId: buildingId }).orderBy('createdAt', 'desc').limit(PAGE_SIZE).skip(page * PAGE_SIZE).get();
  const userIds = [...new Set(result.data.filter((item) => item.targetType === 'USER').map((item) => String(item.targetId || '')).filter(Boolean))];
  const orderIds = [...new Set(result.data.filter((item) => item.targetType === 'ORDER' || item.targetType === 'COMPLAINT').map((item) => String(item.orderId || item.targetId || '')).filter(Boolean))];
  const usersById = {};
  const ordersById = {};
  for (const id of userIds) {
    try {
      const user = (await db.collection('users').doc(id).get()).data;
      if (user) usersById[id] = { realName: user.realName || '', studentNo: user.studentNo || '' };
    } catch (error) {
      console.warn('operation log user summary unavailable', { id, message: error?.message || error?.errMsg || '' });
    }
  }
  for (const id of orderIds) {
    try {
      const order = (await db.collection('orders').doc(id).get()).data;
      if (order) ordersById[id] = { orderNo: order.orderNo || '' };
    } catch (error) {
      console.warn('operation log order summary unavailable', { id, message: error?.message || error?.errMsg || '' });
    }
  }
  const items = result.data.map((item) => {
    const orderId = String(item.orderId || item.targetId || '');
    return { ...item, targetUser: usersById[String(item.targetId || '')] || null, targetOrder: ordersById[orderId] || null };
  });
  return ok({ items, page, hasMore: result.data.length === PAGE_SIZE });
}

async function orderList({ db, openid, data }) {
  const { admin, buildingId } = await currentAdmin(db, openid);
  const page = Math.max(0, Number(data?.page || 0));
  const mode = data?.filterMode || 'ALL_FLOORS';
  const condition = { buildingId, status: 'WAITING', withdrawn: false };
  if (mode === 'MY_FLOOR') condition.floorNo = Number(admin.dormSnapshot?.floorNo);
  else if (mode === 'SPECIFIC_FLOOR') {
    const floorNo = Number(data?.selectedFloorNo);
    if (!Number.isInteger(floorNo) || floorNo < 1 || floorNo > 11) throw fail('VALIDATION_ERROR', '楼层无效');
    condition.floorNo = floorNo;
  } else if (mode !== 'ALL_FLOORS') throw fail('VALIDATION_ERROR', '筛选方式无效');
  const requiredCount = (page + 1) * PAGE_SIZE;
  const available = [];
  for (let offset = 0; offset < 500 && available.length < requiredCount + 1; offset += 100) {
    const batch = await db.collection('orders').where(condition).orderBy('createdAt', 'desc').limit(100).skip(offset).get();
    const now = Date.now();
    available.push(...batch.data.filter((order) => {
      const expiresAt = order.expiresAt ? new Date(order.expiresAt).getTime() : new Date(order.createdAt).getTime() + 12 * 60 * 60 * 1000;
      return Number.isFinite(expiresAt) && expiresAt > now;
    }));
    if (batch.data.length < 100) break;
  }
  const pageItems = available.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return ok({ items: pageItems.map((order) => ({ id: order._id, orderNo: order.orderNo || '', itemName: order.itemName || '', status: order.withdrawn ? 'EXPIRED' : order.status,
    buildingId: order.buildingId, floorNo: order.floorNo, roomNo: order.publisherSnapshot?.roomNo || '', pickupAddress: order.pickupAddress || '', remark: order.remark || '',
    imageFileIds: Array.isArray(order.imageFileIds) ? order.imageFileIds : [],
    timeLimitMinutes: order.timeLimitMinutes || 10, createdAt: order.createdAt,
    overdue: Boolean(order.overdue), publisherName: order.publisherSnapshot?.displayName || '', receiverName: order.receiverSnapshot?.displayName || '' })),
    page, hasMore: available.length > (page + 1) * PAGE_SIZE });
}

async function orderDetail({ db, openid, data }) {
  const { buildingId } = await currentAdmin(db, openid);
  const orderId = validId(data?.orderId, 'INVALID_ORDER_ID', '订单信息无效');
  const order = (await db.collection('orders').doc(orderId).get()).data;
  if (!order || order.buildingId !== buildingId) throw fail('FORBIDDEN_BUILDING_SCOPE', '无权处理其他宿舍楼的业务');
  const expiresAt = order.expiresAt ? new Date(order.expiresAt).getTime() : new Date(order.createdAt).getTime() + 12 * 60 * 60 * 1000;
  if (order.withdrawn || order.status === 'EXPIRED' || !Number.isFinite(expiresAt) || order.status === 'WAITING' && expiresAt <= Date.now()) return fail('ORDER_EXPIRED', '订单已失效');
  if (order.status === 'DELIVERING') return fail('ORDER_DELIVERING', '订单正在配送中');
  if (order.status === 'COMPLETED') return fail('ORDER_COMPLETED', '订单已完成');
  if (order.status !== 'WAITING') return fail('ORDER_UNAVAILABLE', '订单当前不可下架');
  return ok({ id: order._id, orderNo: order.orderNo || '', itemName: order.itemName || '', remark: order.remark || '', imageFileIds: order.imageFileIds || [],
    status: order.withdrawn ? 'EXPIRED' : order.status, pickupAddress: order.pickupAddress || '', createdAt: order.createdAt, acceptedAt: order.acceptedAt || null,
    completedAt: order.completedAt || null, deliveryDeadline: order.deliveryDeadline || null, overdue: Boolean(order.overdue),
    complaintStatus: order.complaintStatus || 'NONE', rewardStatus: order.rewardStatus || 'NONE', rewardAmount: order.rewardAmount ?? null,
    publisherSnapshot: order.publisherSnapshot || {}, receiverSnapshot: order.receiverSnapshot || {}, buildingId: order.buildingId,
    buildingName: order.publisherSnapshot?.buildingName || '', floorNo: order.floorNo, roomNo: order.publisherSnapshot?.roomNo || '' });
}

module.exports = { currentAdmin, writeLog, userList, userDetail, updateUserProfile, setBusinessRestrictions, invalidateOrder,
  operationLogList, orderList, orderDetail, periodStartFor, inferredEverAccepted, inferredOffShelfType, calculateAcceptanceStats };
