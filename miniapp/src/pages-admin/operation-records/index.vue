<template>
  <view class="page">
    <view class="title">我的业务操作记录</view>
    <view v-if="errorMessage" class="error-state">
      {{ errorMessage }}
      <button class="retry" @click="load(true)">重新加载</button>
    </view>
    <view v-else-if="!items.length && !loading" class="empty">暂无我的业务操作记录</view>
    <view v-for="item in items" :key="item._id" class="card">
      <view class="row">
        <text class="action">{{ actionLabel(item.action) }}</text>
        <text class="status">{{ targetLabel(item.targetType) }}</text>
      </view>
      <view v-for="line in displayLines(item)" :key="line" class="change-line">{{ line }}</view>
      <view class="muted">操作时间：{{ formatShanghaiDateTime(item.createdAt) }}</view>
      <button v-if="isOrderRecord(item)" class="record-link" @click="openOrder(item)">查看订单</button>
      <button v-else-if="isUserRecord(item)" class="record-link" @click="openUser(item)">查看学生信息</button>
    </view>
    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="items.length && !hasMore" class="end">没有更多了</view>
  </view>
</template>

<script setup>
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { api } from '../../utils/request';
import { formatShanghaiDateTime } from '../../utils/orderDisplay';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';

const items = ref([]);
const page = ref(0);
const hasMore = ref(true);
const loading = ref(false);
const errorMessage = ref('');

function actionLabel(action) {
  return ({
    ADMIN_UPDATE_USER_PROFILE: '修改用户资料',
    ADMIN_BLOCK_PUBLISH: '禁止发单',
    ADMIN_RESTORE_PUBLISH: '恢复发单',
    ADMIN_BLOCK_ACCEPT: '禁止接单',
    ADMIN_RESTORE_ACCEPT: '恢复接单',
    ADMIN_BLOCK_BUSINESS: '禁止发单和接单',
    ADMIN_RESTORE_BUSINESS: '恢复发单和接单',
    ADMIN_INVALIDATE_ORDER: '下架订单',
    COMPLAINT_UPHOLD: '投诉审核',
    COMPLAINT_DISMISS: '投诉审核'
  })[action] || '业务操作';
}

function targetLabel(type) {
  if (type === 'COMPLAINT') return '投诉订单';
  if (type === 'ORDER') return '订单';
  return '用户';
}

function text(value) {
  return value === undefined || value === null || value === '' ? '未记录' : String(value);
}

function displayLines(item) {
  if (item.targetType === 'USER') {
    const current = item.targetUser || {};
    const snapshot = item.afterData || item.beforeData || {};
    return [
      `姓名：${text(current.realName || snapshot.realName)}`,
      `学号：${text(current.studentNo || snapshot.studentNo)}`
    ];
  }
  const orderNo = text(item.targetOrder?.orderNo);
  if (item.action === 'ADMIN_INVALIDATE_ORDER') return [`订单编号：${orderNo}`];
  if (item.action?.startsWith('COMPLAINT_')) {
    const after = item.afterData || {};
    return [
      `订单编号：${orderNo}`,
      `审核结果：${after.status === 'UPHELD' ? '投诉成立' : '投诉不成立'}`,
      after.reviewRemark ? `审核备注：${after.reviewRemark}` : '审核备注：无'
    ];
  }
  return [];
}

function isOrderRecord(item) {
  return item.targetType === 'ORDER' || item.targetType === 'COMPLAINT';
}

function isUserRecord(item) {
  return item.targetType === 'USER';
}

function openOrder(item) {
  const orderId = String(item.orderId || item.targetId || '').trim();
  if (!orderId) return uni.showToast({ title: '订单信息无效', icon: 'none' });
  uni.navigateTo({ url: `/pages/order-detail/index?id=${encodeURIComponent(orderId)}&viewOnly=1` });
}

function openUser(item) {
  const userId = String(item.targetId || '').trim();
  if (!userId) return uni.showToast({ title: '学生信息无效', icon: 'none' });
  uni.navigateTo({ url: `/pages-admin/user-detail/index?userId=${encodeURIComponent(userId)}` });
}

async function load(reset = false) {
  if (loading.value || (!reset && !hasMore.value)) return;
  if (reset) {
    items.value = [];
    page.value = 0;
    hasMore.value = true;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await api.adminOperationLogs({ page: page.value });
    items.value.push(...result.items);
    page.value += 1;
    hasMore.value = result.hasMore;
  } catch (error) {
    errorMessage.value = typeof error?.code === 'string' && error?.message ? error.message : '加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

onShow(() => load(true));
onPullDownRefresh(() => runPullDownRefresh(() => load(true)));
onReachBottom(() => load());
</script>

<style scoped>
.action { font-weight: 600; }
.card { line-height: 1.8; }
.change-line { color: #334a43; font-size: 27rpx; }
.record-link { margin: 16rpx 0 0; background: #edf5f2; color: #147a69; font-size: 26rpx; }
.record-link::after { border: 0; }
.error-state { text-align: center; color: #a02b2b; padding: 60rpx 0; }
.retry { width: 220rpx; margin-top: 20rpx; font-size: 26rpx; }
.end { text-align: center; color: #6a7d76; padding: 24rpx; }
</style>
