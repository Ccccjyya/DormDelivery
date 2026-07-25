const { ROLES, assertActive, requireExactRole } = require('../common/permissions');
const { ok, fail } = require('../common/response');
const { loadRules, normalizeRules } = require('./businessRules');
const { periodStartFor, calculateAcceptanceStats } = require('./admin');

const PAGE_SIZE = 20;

async function userByOpenid(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

async function superUser(db, openid) {
  return requireExactRole(assertActive(await userByOpenid(db, openid)), ROLES.SUPER_ADMIN);
}

function publicAccount(user) {
  return { id: user._id, realName: user.realName || '', studentNo: user.studentNo || '', phone: user.phone || user.phoneNumber || '', role: user.role,
    accountStatus: user.accountStatus, profileCompleted: Boolean(user.profileCompleted), dormBuildingId: user.dormBuildingId || user.dormSnapshot?.buildingId || null,
    dormBuildingName: user.dormSnapshot?.buildingName || '', floorNo: user.dormSnapshot?.floorNo || null, roomNo: user.dormSnapshot?.roomNo || '',
    contributionScore: user.contributionScore ?? 60, postingQuota: user.postingQuota ?? 0, createdAt: user.createdAt };
}

async function log(db, operator, action, targetType, targetId, beforeSnapshot, afterSnapshot, ruleVersion = null) {
  await db.collection('operationLogs').add({ data: { operatorId: operator._id, operatorRole: ROLES.SUPER_ADMIN,
    action, targetType, targetId, beforeSnapshot, afterSnapshot, ruleVersion, createdAt: new Date() } });
}

async function ruleGet({ db, openid }) {
  await superUser(db, openid);
  return ok(await loadRules(db));
}

async function ruleUpdate({ db, openid, data }) {
  return db.runTransaction(async (tx) => {
    const operator = await superUser(tx, openid);
    const before = await loadRules(tx);
    const type = data?.ruleType;
    const proposed = { ...before };
    if (type === 'WEEKLY_DEDUCTION') proposed.contributionBands = before.contributionBands.map((band, index) => ({ ...band, weeklyDeduction: Number(data.values?.[index]) }));
    else if (type === 'WEEKLY_POSTING_QUOTA') proposed.contributionBands = before.contributionBands.map((band, index) => ({ ...band, weeklyPostingQuota: Number(data.values?.[index]) }));
    else if (type === 'COMPLETION_REWARD') proposed.completionReward = Number(data.value);
    else if (type === 'COMPLAINT_PENALTY') proposed.upheldComplaintPenalty = Number(data.value);
    else if (type === 'INACTIVE_EXTRA_PENALTY') proposed.inactiveExtraPenalty = Number(data.value);
    else throw fail('VALIDATION_ERROR', '规则类型无效');
    proposed.version = Number(before.version || 1) + 1;
    const after = normalizeRules(proposed);
    const { _id: ignoredAfterId, ...afterSnapshot } = after;
    const { _id: ignoredBeforeId, ...beforeSnapshot } = before;
    const now = new Date();
    await tx.collection('systemRules').doc('business-rules').set({
      data: { ...afterSnapshot, updatedAt: now, updatedBy: operator._id }
    });
    await log(tx, operator, 'SYSTEM_RULE_UPDATE', 'SYSTEM_RULE', 'business-rules', beforeSnapshot, afterSnapshot, after.version);
    return ok(after);
  });
}

async function accountList({ db, openid, data }) {
  await superUser(db, openid);
  const page = Math.max(0, Number(data?.page || 0));
  const keyword = String(data?.keyword || '').trim().toLowerCase();
  const role = [ROLES.USER, ROLES.ADMIN].includes(data?.role) ? data.role : null;
  const status = ['ACTIVE', 'DISABLED'].includes(data?.accountStatus) ? data.accountStatus : null;
  const appointable = data?.appointable === true;
  const all = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const batch = await db.collection('users').orderBy('createdAt', 'desc').skip(offset).limit(100).get();
    all.push(...batch.data.filter((item) => item.role !== ROLES.SUPER_ADMIN));
    if (batch.data.length < 100) break;
  }
  const filtered = all.filter((item) => (!role || item.role === role) && (!status || item.accountStatus === status)
    && (!appointable || (item.role === ROLES.USER && item.accountStatus === 'ACTIVE' && item.profileCompleted
      && Boolean(item.dormBuildingId || item.dormSnapshot?.buildingId)))
    && (!keyword || String(item.realName || '').toLowerCase().includes(keyword)
      || String(item.studentNo || '').toLowerCase().includes(keyword)
      || String(item.phone || item.phoneNumber || '').toLowerCase().includes(keyword)));
  return ok({ items: filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(publicAccount), page, hasMore: filtered.length > (page + 1) * PAGE_SIZE });
}

async function setAccountStatus({ db, openid, data }) {
  const userId = String(data?.userId || '').trim();
  const status = data?.accountStatus;
  if (!userId || !['ACTIVE', 'DISABLED'].includes(status)) throw fail('VALIDATION_ERROR', '账号状态参数无效');
  return db.runTransaction(async (tx) => {
    const operator = await superUser(tx, openid);
    if (userId === operator._id) throw fail('FORBIDDEN', '不能禁用自己的账号');
    const target = (await tx.collection('users').doc(userId).get()).data;
    if (!target || target.role === ROLES.SUPER_ADMIN) throw fail('FORBIDDEN', '不能通过账号管理操作超级管理员');
    if (target.accountStatus === status) return ok(publicAccount(target));
    const now = new Date();
    const updates = status === 'DISABLED'
      ? { accountStatus: status, postingQuota: 0, disabledAt: now, disabledBy: operator._id, updatedAt: now }
      : { accountStatus: status, enabledAt: now, enabledBy: operator._id, updatedAt: now };
    await tx.collection('users').doc(userId).update({ data: updates });
    await log(tx, operator, status === 'DISABLED' ? 'ACCOUNT_DISABLE' : 'ACCOUNT_ENABLE', 'USER', userId,
      { accountStatus: target.accountStatus, postingQuota: target.postingQuota }, { accountStatus: status, postingQuota: status === 'DISABLED' ? 0 : target.postingQuota });
    return ok(publicAccount({ ...target, ...updates }));
  });
}

async function setAdminRole({ db, openid, data }) {
  const userId = String(data?.userId || '').trim();
  const role = data?.role;
  if (!userId || ![ROLES.USER, ROLES.ADMIN].includes(role)) throw fail('VALIDATION_ERROR', '角色参数无效');
  return db.runTransaction(async (tx) => {
    const operator = await superUser(tx, openid);
    const target = (await tx.collection('users').doc(userId).get()).data;
    if (!target || target.role === ROLES.SUPER_ADMIN) throw fail('FORBIDDEN', '不能修改超级管理员角色');
    if (role === ROLES.ADMIN && (target.role !== ROLES.USER || target.accountStatus !== 'ACTIVE' || !target.profileCompleted || !(target.dormBuildingId || target.dormSnapshot?.buildingId))) {
      throw fail('ADMIN_APPOINTMENT_INVALID', '只能任命资料完整的正常普通用户');
    }
    if (role === ROLES.USER && target.role !== ROLES.ADMIN) throw fail('ADMIN_REVOKE_INVALID', '该用户不是管理员');
    const now = new Date();
    await tx.collection('users').doc(userId).update({ data: { role, updatedAt: now } });
    await log(tx, operator, role === ROLES.ADMIN ? 'ADMIN_APPOINT' : 'ADMIN_REVOKE', 'USER', userId, { role: target.role }, { role });
    return ok(publicAccount({ ...target, role, updatedAt: now }));
  });
}

function cleanAnnouncement(data) {
  const title = String(data?.title || '').trim();
  const content = String(data?.content || '').trim();
  if (!title || title.length > 80) throw fail('VALIDATION_ERROR', '请填写80字以内的公告标题');
  if (!content || content.length > 2000) throw fail('VALIDATION_ERROR', '请填写2000字以内的公告内容');
  return { title, content, announcementType: data?.announcementType === 'RULE_UPDATE' ? 'RULE_UPDATE' : 'GENERAL',
    relatedRuleVersion: data?.relatedRuleVersion ? Number(data.relatedRuleVersion) : null,
    relatedRuleType: data?.relatedRuleType ? String(data.relatedRuleType) : null };
}

async function announcementSave({ db, openid, data }) {
  const operator = await superUser(db, openid);
  const payload = cleanAnnouncement(data);
  const now = new Date();
  const announcementId = String(data?.announcementId || '').trim();
  if (announcementId) {
    const before = (await db.collection('announcements').doc(announcementId).get()).data;
    if (!before) throw fail('NOT_FOUND', '公告不存在');
    const updates = { ...payload, status: 'PUBLISHED', publishedAt: before.publishedAt || now, updatedAt: now, updatedBy: operator._id };
    await db.collection('announcements').doc(announcementId).update({ data: updates });
    await log(db, operator, 'ANNOUNCEMENT_UPDATE', 'ANNOUNCEMENT', announcementId, before, updates, payload.relatedRuleVersion);
    if (before.status !== 'PUBLISHED') await log(db, operator, 'ANNOUNCEMENT_PUBLISH', 'ANNOUNCEMENT', announcementId, { status: before.status }, { status: 'PUBLISHED' }, payload.relatedRuleVersion);
    return ok({ announcementId });
  }
  const added = await db.collection('announcements').add({ data: { ...payload, status: 'PUBLISHED', publishedAt: now,
    createdAt: now, updatedAt: now, createdBy: operator._id, updatedBy: operator._id } });
  await log(db, operator, 'ANNOUNCEMENT_CREATE', 'ANNOUNCEMENT', added._id, null, payload, payload.relatedRuleVersion);
  await log(db, operator, 'ANNOUNCEMENT_PUBLISH', 'ANNOUNCEMENT', added._id, null, { status: 'PUBLISHED' }, payload.relatedRuleVersion);
  return ok({ announcementId: added._id });
}

async function announcementOffline({ db, openid, data }) {
  const operator = await superUser(db, openid);
  const id = String(data?.announcementId || '').trim();
  const before = id ? (await db.collection('announcements').doc(id).get()).data : null;
  if (!before) throw fail('NOT_FOUND', '公告不存在');
  const now = new Date();
  await db.collection('announcements').doc(id).update({ data: { status: 'OFFLINE', updatedAt: now, updatedBy: operator._id } });
  await log(db, operator, 'ANNOUNCEMENT_OFFLINE', 'ANNOUNCEMENT', id, { status: before.status }, { status: 'OFFLINE' }, before.relatedRuleVersion);
  return ok({ announcementId: id });
}

async function announcementAdminList({ db, openid, data }) {
  await superUser(db, openid);
  const page = Math.max(0, Number(data?.page || 0));
  const result = await db.collection('announcements').orderBy('createdAt', 'desc').skip(page * PAGE_SIZE).limit(PAGE_SIZE).get();
  return ok({ items: result.data.map((item) => ({ ...item, id: item._id })), page, hasMore: result.data.length === PAGE_SIZE });
}

async function announcementPublicList({ db, openid, data }) {
  assertActive(await userByOpenid(db, openid));
  const page = Math.max(0, Number(data?.page || 0));
  const result = await db.collection('announcements').where({ status: 'PUBLISHED' }).orderBy('publishedAt', 'desc').skip(page * PAGE_SIZE).limit(PAGE_SIZE).get();
  return ok({ items: result.data.map((item) => ({ id: item._id, title: item.title, content: item.content, announcementType: item.announcementType,
    relatedRuleVersion: item.relatedRuleVersion || null, relatedRuleType: item.relatedRuleType || null, publishedAt: item.publishedAt })), page, hasMore: result.data.length === PAGE_SIZE });
}

async function announcementDetail({ db, openid, data }) {
  const current = assertActive(await userByOpenid(db, openid));
  const item = (await db.collection('announcements').doc(String(data?.announcementId || '')).get()).data;
  if (!item || (item.status !== 'PUBLISHED' && current.role !== ROLES.SUPER_ADMIN)) throw fail('NOT_FOUND', '公告不存在');
  return ok({ id: item._id, title: item.title, content: item.content, status: item.status, announcementType: item.announcementType,
    relatedRuleVersion: item.relatedRuleVersion || null, relatedRuleType: item.relatedRuleType || null, publishedAt: item.publishedAt });
}

async function operationLogs({ db, openid, data }) {
  await superUser(db, openid);
  const page = Math.max(0, Number(data?.page || 0));
  const result = await db.collection('operationLogs').where({ operatorRole: ROLES.SUPER_ADMIN }).orderBy('createdAt', 'desc').skip(page * PAGE_SIZE).limit(PAGE_SIZE).get();
  const operatorIds = [...new Set(result.data.map((item) => item.operatorId).filter((id) => id && id !== 'SYSTEM'))];
  const operators = new Map();
  await Promise.all(operatorIds.map(async (id) => {
    try { const operator = (await db.collection('users').doc(id).get()).data; if (operator) operators.set(id, operator.realName || '超级管理员'); } catch (_) {}
  }));
  const userTargetIds = [...new Set(result.data.filter((item) => item.targetType === 'USER').map((item) => item.targetId).filter(Boolean))];
  const announcementTargetIds = [...new Set(result.data.filter((item) => item.targetType === 'ANNOUNCEMENT').map((item) => item.targetId).filter(Boolean))];
  const targetNames = new Map();
  await Promise.all(userTargetIds.map(async (id) => { try { const target = (await db.collection('users').doc(id).get()).data; if (target) targetNames.set(id, `${target.realName || '未完善资料'}${target.studentNo ? `（${target.studentNo}）` : ''}`); } catch (_) {} }));
  await Promise.all(announcementTargetIds.map(async (id) => { try { const target = (await db.collection('announcements').doc(id).get()).data; if (target) targetNames.set(id, target.title || '公告'); } catch (_) {} }));
  return ok({ items: result.data.map((item) => ({ ...item, id: item._id,
    operatorName: operators.get(item.operatorId) || '超级管理员', targetName: targetNames.get(item.targetId) || '', beforeSnapshot: item.beforeSnapshot || null,
    afterSnapshot: item.afterSnapshot || null })), page, hasMore: result.data.length === PAGE_SIZE });
}

async function acceptanceStats({ db, openid, data }) {
  await superUser(db, openid);
  const period = ['WEEK', '30_DAYS', 'ALL'].includes(data?.period) ? data.period : 'WEEK';
  const now = new Date();
  const periodStart = periodStartFor(period, now);
  const orders = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const batch = await db.collection('orders').skip(offset).limit(100).get();
    orders.push(...batch.data);
    if (batch.data.length < 100) break;
  }
  const periodOrders = periodStart
    ? orders.filter((order) => order.createdAt && new Date(order.createdAt) >= periodStart)
    : orders;
  return ok({ ...calculateAcceptanceStats(periodOrders, now), periodStart, periodEnd: now, period, scope: 'GLOBAL' });
}

// 便利店公开接口（不需要角色验证，供商城页使用）
async function groceryCatListPublic({ db }) {
  const res = await db.collection('groceryCategories').orderBy('createdAt', 'asc').get();
  return ok({ items: res.data });
}
async function groceryProductListPublic({ db, data }) {
  let q = db.collection('groceryProducts').orderBy('createdAt', 'desc');
  if (data?.category) q = q.where({ category: data.category });
  const res = await q.get();
  return ok({ items: res.data });
}

// 便利店分类管理
async function groceryCatList({ db, openid }) {
  await superUser(db, openid);
  const res = await db.collection('groceryCategories').orderBy('createdAt', 'asc').get();
  return ok({ items: res.data });
}
async function groceryCatSave({ db, openid, data }) {
  await superUser(db, openid);
  const { id, name, subs: _subs } = data || {};
  const subs = (Array.isArray(_subs) ? _subs : String(_subs || '').split(/[,，]/).map(s => s.trim()).filter(Boolean));
  if (!(name || '').trim()) return fail('VALIDATION_ERROR', '请输入分类名');
  const doc = { name: name.trim(), subs, updatedAt: new Date() };
  if (id) { await db.collection('groceryCategories').doc(id).update({ data: doc }); return ok({ id }); }
  doc.key = 'cat_' + Date.now(); doc.createdAt = new Date();
  const added = await db.collection('groceryCategories').add({ data: doc });
  return ok({ id: added._id });
}
async function groceryCatDelete({ db, openid, data }) {
  await superUser(db, openid);
  await db.collection('groceryCategories').doc(data.id).remove();
  return ok({});
}

// 便利店商品管理
async function groceryProductList({ db, openid, data }) {
  await superUser(db, openid);
  let q = db.collection('groceryProducts').orderBy('createdAt', 'desc');
  if (data?.category) q = q.where({ category: data.category });
  const res = await q.get();
  return ok({ items: res.data });
}
async function groceryProductSave({ db, openid, data }) {
  await superUser(db, openid);
  const { id, name, price, imageFileId, category, categoryName, sub, subName } = data || {};
  if (!(name || '').trim()) return fail('VALIDATION_ERROR', '请输入商品名');
  if (!category) return fail('VALIDATION_ERROR', '请选择分类');
  const numPrice = Number(price);
  if (!numPrice || numPrice <= 0) return fail('VALIDATION_ERROR', '请输入有效价格');
  const doc = { name: name.trim(), price: numPrice, imageFileId: imageFileId || '', category, categoryName: categoryName || '',
    sub: sub || '', subName: subName || '全部', updatedAt: new Date() };
  if (id) { await db.collection('groceryProducts').doc(id).update({ data: doc }); return ok({ id }); }
  doc.createdAt = new Date();
  const added = await db.collection('groceryProducts').add({ data: doc });
  return ok({ id: added._id });
}
async function groceryProductDelete({ db, openid, data }) {
  await superUser(db, openid);
  await db.collection('groceryProducts').doc(data.id).remove();
  return ok({});
}

module.exports = { ruleGet, ruleUpdate, accountList, setAccountStatus, setAdminRole, announcementSave, announcementOffline,
  announcementAdminList, announcementPublicList, announcementDetail, operationLogs, acceptanceStats,
  groceryCatList, groceryCatSave, groceryCatDelete,
  groceryProductList, groceryProductSave, groceryProductDelete,
  groceryCatListPublic, groceryProductListPublic };
