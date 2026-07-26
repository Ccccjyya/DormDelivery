import { CLOUD_API_FUNCTION } from '../config/cloudbase';
import { safeReLaunch } from './navigation';

let handlingDisabledAccount = false;

function exitDisabledAccount() {
  if (handlingDisabledAccount) return;
  handlingDisabledAccount = true;
  uni.removeStorageSync('cloudProfile');
  uni.setStorageSync('accountDisabledExit', true);
  uni.showToast({ title: '账号已被禁用', icon: 'none' });
  setTimeout(() => {
    safeReLaunch('/pages/login/index').finally(() => {
      setTimeout(() => { handlingDisabledAccount = false; }, 1000);
    });
  }, 500);
}

export function cloudRequest(action, data = {}) {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.cloud) {
      const error = { code: 'CLOUD_UNAVAILABLE', message: '请在微信小程序云开发环境中运行' };
      uni.showToast({ title: error.message, icon: 'none' });
      reject(error);
      return;
    }
    wx.cloud.callFunction({
      name: CLOUD_API_FUNCTION,
      data: { action, data },
      success: ({ result }) => {
        if (result?.code === 0) return resolve(result.data);
        const error = result || { code: 'CLOUD_FUNCTION_ERROR', message: '云函数返回异常' };
        console.error('cloud request rejected', { action, code: error.code, message: error.message });
        if (error.code === 'ACCOUNT_DISABLED') exitDisabledAccount();
        else if (error.code === 'FORBIDDEN') uni.showToast({ title: '权限不足', icon: 'none' });
        else if (error.code === 'FIELD_LOCKED') uni.showToast({ title: '已锁定', icon: 'none' });
        else if (error.code === 'PUBLISH_BLOCKED') uni.showToast({ title: '已被禁止发单', icon: 'none' });
        else if (error.code === 'ACCEPT_BLOCKED') uni.showToast({ title: '已被禁止接单', icon: 'none' });
        else if (error.code === 'QUOTA_EXHAUSTED') uni.showToast({ title: '发布次数已用尽', icon: 'none' });
        else if (error.code === 'INSUFFICIENT_SCORE') uni.showToast({ title: '贡献值不足', icon: 'none' });
        else uni.showToast({ title: error.message || '请求失败', icon: 'none' });
        reject(error);
      },
      fail: (error) => {
        console.error('cloud request failed', { action, code: error?.errCode || 'CALL_FAILED', message: error?.errMsg || error?.message || '' });
        uni.showToast({ title: '云函数调用失败，请检查网络和部署状态', icon: 'none' });
        reject(error);
      }
    });
  });
}

const pending = () => Promise.reject({ code: 'MODULE_PENDING', message: '该模块将在第二阶段迁移' });

// Existing pages continue to import api; only the first-phase actions are cloud-enabled.
export const api = {
  wechatLogin: () => cloudRequest('auth.login'),
  me: () => cloudRequest('user.me'),
  completeProfile: (data) => cloudRequest('user.completeProfile', data),
  updateMe: (data) => cloudRequest('user.completeProfile', data),
  merchantApply: (data) => cloudRequest('merchant.apply', data),
  merchantMyApplication: () => cloudRequest('merchant.myApplication', {}),
  buildings: () => cloudRequest('dorm.getBuildings'),
  floors: (buildingId) => cloudRequest('dorm.getFloors', { buildingId }),
  rooms: (buildingId, floorNo) => cloudRequest('dorm.getRooms', { buildingId, floorNo }),
  availableOrders: (filter) => cloudRequest('order.available', filter),
  createOrder: (data) => cloudRequest('order.create', data),
  orderDetail: (orderId) => cloudRequest('order.detail', { orderId }),
  acceptOrder: (orderId) => cloudRequest('order.accept', { orderId }),
  completeOrder: (orderId) => cloudRequest('order.complete', { orderId }),
  expireOrder: (orderId) => cloudRequest('order.withdraw', { orderId }),
  myPublished: (data = {}) => cloudRequest('order.myPublished', data),
  myReceived: (data = {}) => cloudRequest('order.myReceived', data),
  complaint: (data) => cloudRequest('complaint.submit', data),
  myComplaints: (data = {}) => cloudRequest('complaint.mine', data),
  complaintDetail: (complaintId) => cloudRequest('complaint.detail', { complaintId }),
  contributionRecords: (data = {}) => cloudRequest('contribution.mine', data),
  quotaRecords: (data = {}) => cloudRequest('weeklyQuota.mine', data),
  announcements: (data = {}) => cloudRequest('announcement.list', data),
  announcementDetail: (announcementId) => cloudRequest('announcement.detail', { announcementId }),
  adminOrders: (data = {}) => cloudRequest('admin.orderList', data),
  adminOrderDetail: (orderId) => cloudRequest('admin.orderDetail', { orderId }),
  adminInvalidateOrder: (data) => cloudRequest('admin.orderInvalidate', data),
  adminComplaints: (data = {}) => cloudRequest('complaint.adminList', data),
  adminComplaintDetail: (complaintId) => cloudRequest('complaint.adminDetail', { complaintId }),
  reviewComplaint: (data) => cloudRequest('complaint.review', data),
  adminUsers: (data = {}) => cloudRequest('admin.userList', data),
  adminUserDetail: (userId) => cloudRequest('admin.userDetail', { userId }),
  adminUpdateUserProfile: (data) => cloudRequest('admin.updateUserProfile', data),
  setBusinessRestrictions: (data) => cloudRequest('admin.setBusinessRestrictions', data),
  adminOperationLogs: (data = {}) => cloudRequest('admin.operationLogs', data),
  superRules: () => cloudRequest('rule.get'),
  updateSuperRule: (data) => cloudRequest('rule.update', data),
  superAccounts: (data = {}) => cloudRequest('super.accountList', data),
  setSuperAccountStatus: (data) => cloudRequest('super.accountStatus', data),
  setSuperAdminRole: (data) => cloudRequest('super.adminRole', data),
  superAnnouncements: (data = {}) => cloudRequest('announcement.adminList', data),
  saveAnnouncement: (data) => cloudRequest('announcement.save', data),
  offlineAnnouncement: (announcementId) => cloudRequest('announcement.offline', { announcementId }),
  superLogs: (data = {}) => cloudRequest('super.operationLogs', data),
  superAcceptanceStats: (period = 'WEEK') => cloudRequest('super.acceptanceStats', { period }),
  groceryCatList: () => cloudRequest('grocery.catList', {}),
  groceryProductList: (data = {}) => cloudRequest('grocery.productList', data),
  superGroceryCatList: () => cloudRequest('super.groceryCatList', {}),
  superGroceryCatSave: (data) => cloudRequest('super.groceryCatSave', data),
  superGroceryCatDelete: (id) => cloudRequest('super.groceryCatDelete', { id }),
  superGroceryProductList: (data = {}) => cloudRequest('super.groceryProductList', data),
  superGroceryProductSave: (data) => cloudRequest('super.groceryProductSave', data),
  superGroceryProductDelete: (id) => cloudRequest('super.groceryProductDelete', { id }),
  superMerchantApplications: (data) => cloudRequest('super.merchantApplications', data),
  superMerchantApplicationDetail: (data) => cloudRequest('super.merchantApplicationDetail', data),
  superMerchantReview: (data) => cloudRequest('super.merchantApplicationReview', data),
  // 贡献值排行榜（预留）
  contributionLeaderboard: (data = {}) => cloudRequest('leaderboard.list', data),
  sendChat: (data) => cloudRequest('chat.send', data),
  chatMessages: (data) => cloudRequest('chat.list', data),
  chatConversations: () => cloudRequest('chat.conversations', {})
};

// Kept for legacy pages until their cloud-function modules are migrated.
export function request() {
  return pending();
}
