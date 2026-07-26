const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { login } = require('./services/auth');
const { me, completeProfile, merchantApply, myMerchantApplication } = require('./services/profile');
const { getBuildings, getFloors, getRooms } = require('./services/dorm');
const orders = require('./services/orders');
const complaints = require('./services/complaints');
const admin = require('./services/admin');
const maintenance = require('./services/maintenance');
const weeklyMaintenance = require('./services/weeklyMaintenance');
const superAdmin = require('./services/superAdmin');
const chat = require('./services/chat');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function currentUser(openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

exports.main = async (event = {}) => {
  try {
    const { OPENID: openid } = cloud.getWXContext();
    const context = { db, openid, data: event.data || {} };
    if (event.action === 'maintenance.runBatch') {
      if (openid || event.source !== 'scheduledMaintenance') return fail('FORBIDDEN', '权限不足');
      const limit = event.data?.limit;
      const orderExpiration = await maintenance.expireEligibleOrdersBatch(db, { limit });
      const rewardSettlement = await maintenance.settleEligibleRewardsBatch(db, { limit });
      return ok({ orderExpiration, rewardSettlement });
    }
    if (event.action === 'maintenance.runWeeklyBatch') {
      if (openid || event.source !== 'weeklyQuotaMaintenance') return fail('FORBIDDEN', '权限不足');
      return ok(await weeklyMaintenance.settleBatch(db, event.data || {}));
    }
    if (event.action === 'auth.login') return await login(context);
    if (event.action === 'dorm.getBuildings') return await getBuildings(context);
    if (event.action === 'dorm.getFloors') return await getFloors(context);
    if (event.action === 'dorm.getRooms') return await getRooms(context);
    if (event.action === 'order.create') return await orders.create(context);
    if (event.action === 'order.available') return await orders.available(context);
    if (event.action === 'order.detail') return await orders.detail(context);
    if (event.action === 'order.accept') return await orders.accept(context);
    if (event.action === 'order.complete') return await orders.complete(context);
    if (event.action === 'order.withdraw') return await orders.withdraw(context);
    if (event.action === 'order.myPublished') return await orders.mine({ ...context, type: 'PUBLISHED' });
    if (event.action === 'order.myReceived') return await orders.mine({ ...context, type: 'RECEIVED' });
    if (event.action === 'order.expireEligibleBatch') return await orders.expireEligibleBatchAction(context);
    if (event.action === 'order.auditNumberUniqueness') return await orders.auditOrderNumbersAction(context);
    if (event.action === 'complaint.submit') return await complaints.submit(context);
    if (event.action === 'complaint.review') return await complaints.review(context);
    if (event.action === 'complaint.mine') return await complaints.mine(context);
    if (event.action === 'complaint.detail') return await complaints.detail(context);
    if (event.action === 'complaint.adminList') return await complaints.adminList(context);
    if (event.action === 'complaint.adminDetail') return await complaints.adminDetail(context);
    if (event.action === 'contribution.mine') return await complaints.recordList(context);
    if (event.action === 'reward.settleOrder') return await complaints.settleOrder(context);
    if (event.action === 'reward.settleEligibleBatch') return await complaints.settleEligibleBatchAction(context);
    if (event.action === 'grocery.catList') return await superAdmin.groceryCatListPublic(context);
    if (event.action === 'grocery.productList') return await superAdmin.groceryProductListPublic(context);
    if (event.action === 'grocery.merchantList') return await superAdmin.merchantListPublic(context);
    if (event.action === 'admin.userList') return await admin.userList(context);
    if (event.action === 'admin.userDetail') return await admin.userDetail(context);
    if (event.action === 'admin.updateUserProfile') return await admin.updateUserProfile(context);
    if (event.action === 'admin.setBusinessRestrictions') return await admin.setBusinessRestrictions(context);
    if (event.action === 'admin.operationLogs') return await admin.operationLogList(context);
    if (event.action === 'admin.orderList') return await admin.orderList(context);
    if (event.action === 'admin.orderDetail') return await admin.orderDetail(context);
    if (event.action === 'admin.orderInvalidate') return await admin.invalidateOrder(context);
    if (event.action === 'rule.get') return await superAdmin.ruleGet(context);
    if (event.action === 'rule.update') return await superAdmin.ruleUpdate(context);
    if (event.action === 'super.accountList') return await superAdmin.accountList(context);
    if (event.action === 'super.accountStatus') return await superAdmin.setAccountStatus(context);
    if (event.action === 'super.adminRole') return await superAdmin.setAdminRole(context);
    if (event.action === 'announcement.save') return await superAdmin.announcementSave(context);
    if (event.action === 'announcement.offline') return await superAdmin.announcementOffline(context);
    if (event.action === 'announcement.adminList') return await superAdmin.announcementAdminList(context);
    if (event.action === 'announcement.list') return await superAdmin.announcementPublicList(context);
    if (event.action === 'announcement.detail') return await superAdmin.announcementDetail(context);
    if (event.action === 'super.operationLogs') return await superAdmin.operationLogs(context);
    if (event.action === 'super.acceptanceStats') return await superAdmin.acceptanceStats(context);
    if (event.action === 'super.groceryCatList') return await superAdmin.groceryCatList(context);
    if (event.action === 'super.groceryCatSave') return await superAdmin.groceryCatSave(context);
    if (event.action === 'super.groceryCatDelete') return await superAdmin.groceryCatDelete(context);
    if (event.action === 'super.groceryProductList') return await superAdmin.groceryProductList(context);
    if (event.action === 'super.groceryProductSave') return await superAdmin.groceryProductSave(context);
    if (event.action === 'super.groceryProductDelete') return await superAdmin.groceryProductDelete(context);
    if (event.action === 'super.merchantApplications') return await superAdmin.merchantApplications(context);
    if (event.action === 'super.merchantApplicationDetail') return await superAdmin.merchantApplicationDetail(context);
    if (event.action === 'super.merchantApplicationReview') return await superAdmin.merchantApplicationReview(context);
    if (event.action === 'weeklyQuota.mine') return await weeklyMaintenance.recordList(context);

    context.user = await currentUser(openid);
    if (event.action === 'user.me') return await me(context);
    if (event.action === 'user.completeProfile') return await completeProfile(context);
    if (event.action === 'merchant.apply') return await merchantApply(context);
    if (event.action === 'merchant.myApplication') return await myMerchantApplication(context);
    if (event.action === 'chat.send') return await chat.send(context);
    if (event.action === 'chat.list') return await chat.list(context);
    if (event.action === 'chat.conversations') return await chat.conversations(context);
    return fail('MODULE_PENDING', '该云开发模块将在下一阶段迁移');
  } catch (error) {
    console.error('cloud api failed', error);
    const detail = String(error?.errMsg || error?.message || '').toLowerCase();
    if (detail.includes('collection not exists') || detail.includes('-502005')) {
      return fail('SYSTEM_NOT_INITIALIZED', '系统数据尚未初始化，请联系管理员');
    }
    if (typeof error?.code === 'string' && error.code && error.message) return fail(error.code, error.message);
    return fail('INTERNAL_ERROR', '系统繁忙，请稍后重试');
  }
};
