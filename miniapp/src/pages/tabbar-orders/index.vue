<template>
  <view class="page">
    <view class="header-wrapper">
      <StatusBar />
      <view class="page-header">
        <view class="header-title">订单</view>
        <view class="header-tabs">
          <view class="ht-item" :class="{ active: activeTab === 'published' }" @click="switchTab('published')">我的派单</view>
          <view class="ht-item" :class="{ active: activeTab === 'received' }" @click="switchTab('received')">我的接单</view>
        </view>
      </view>
    </view>

    <view class="page-body">

      <view v-if="loading" class="loading-state">加载中...</view>

      <view v-else-if="currentList.length === 0" class="empty-state">
        <text class="empty-emoji">📦</text>
        <text class="empty-text">{{ activeTab === 'published' ? '暂无派单记录' : '暂无接单记录' }}</text>
      </view>

      <view v-else>
        <view v-if="inProgressList.length" class="section">
          <view class="section-label">进行中</view>
          <view v-for="order in inProgressList" :key="order.id" class="order-card" @click="goDetail(order.id)">
            <view class="card-body">
              <view class="type-row">
                <text class="type-tag" :class="'tag-' + order.orderType">{{ order.typeName }}</text>
                <text class="desc-text">{{ order.displayText }}</text>
              </view>
              <view class="route-row">
                <text class="route-from">{{ order.routeFrom }}</text>
                <text class="route-arrow">→</text>
                <text class="route-to">{{ order.routeTo }}</text>
              </view>
            </view>
            <text v-if="order.timerText" class="card-timer" :class="order.timerClass">{{ order.timerText }}</text>
            <view class="card-foot">
              <text class="reward-num">贡献值：{{ order.rewardAmount }}</text>
              <view class="status-pill" :class="'status-' + order.statusClass">{{ order.statusText }}</view>
            </view>
          </view>
        </view>

        <view v-if="completedList.length" class="section">
          <view class="section-label">已完成</view>
          <view v-for="order in completedList" :key="order.id" class="order-card" @click="goDetail(order.id)">
            <view class="card-body">
              <view class="type-row">
                <text class="type-tag" :class="'tag-' + order.orderType">{{ order.typeName }}</text>
                <text class="desc-text">{{ order.displayText }}</text>
              </view>
              <view class="route-row">
                <text class="route-from">{{ order.routeFrom }}</text>
                <text class="route-arrow">→</text>
                <text class="route-to">{{ order.routeTo }}</text>
              </view>
            </view>
            <view class="card-foot">
              <text class="reward-num">贡献值：{{ order.rewardAmount }}</text>
              <view class="status-pill" :class="'status-' + order.statusClass">{{ order.statusText }}</view>
            </view>
          </view>
        </view>
      </view>

      <view class="safe-bottom"></view>
    </view>

    <TabBar selected="orders" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
import TabBar from '@/components/TabBar.vue';
import StatusBar from '@/components/StatusBar.vue';
import { api } from '@/utils/request';

const activeTab = ref('published');
const published = ref([]);
const received = ref([]);
const loading = ref(false);
const now = ref(Date.now());
let timer = 0;

const typeLabel = { takeout: '外卖', package: '快递', grocery: '帮买', printing: '打印' };

function switchTab(tab) {
  activeTab.value = tab;
}

const currentList = computed(() => {
  return (activeTab.value === 'published' ? published.value : received.value).map(formatOrder);
});

const inProgressList = computed(() => {
  return currentList.value.filter(o => ['WAITING', 'DELIVERING'].includes(o.status) && !o.withdrawn);
});

const completedList = computed(() => {
  return currentList.value.filter(o => !['WAITING', 'DELIVERING'].includes(o.status) || o.withdrawn);
});

function formatOrder(order) {
  const pub = order.publisherSnapshot || {};
  const isStation = order.pickupMode === 'station';
  let statusText = { WAITING: '待接单', DELIVERING: '配送中', COMPLETED: '已完成', EXPIRED: '已过期' }[order.status] || order.status;
  if (order.withdrawn) statusText = '已下架';
  const statusClass = order.withdrawn ? 'expired' : { WAITING: 'waiting', DELIVERING: 'delivering', COMPLETED: 'completed', EXPIRED: 'expired' }[order.status] || '';
  return {
    ...order,
    typeName: typeLabel[order.orderType] || '外卖',
    displayText: order.orderDetail || order.itemName,
    routeFrom: order.itemName || (isStation ? '驿站' : '宿舍楼下'),
    routeTo: order.destinationLabel || pub.fullRoomLabel || '',
    statusText,
    statusClass,
    rewardAmount: order.rewardAmount || 0,
    timerText: getTimerText(order),
    timerClass: getTimerClass(order)
  };
}

function getTimerText(order) {
  if (order.withdrawn || order.status === 'COMPLETED' || order.status === 'EXPIRED') return '';
  const limit = order.status === 'DELIVERING' ? (order.deliveryLimitMinutes ?? order.timeLimitMinutes ?? 720) : (order.acceptLimitMinutes ?? order.timeLimitMinutes ?? 720);
  if (limit >= 720) return '不限时';
  const deadline = order.status === 'WAITING' ? order.expiresAt : order.deliveryDeadline;
  if (!deadline) return '';
  const remaining = Math.floor((new Date(deadline).getTime() - now.value) / 1000);
  if (remaining <= 0) {
    if (order.status === 'WAITING') return '已过期';
    const oH = Math.floor(Math.abs(remaining) / 3600), oM = Math.floor((Math.abs(remaining) % 3600) / 60), oS = Math.abs(remaining) % 60;
    return oH > 0 ? '超时 ' + oH + ':' + String(oM).padStart(2, '0') + ':' + String(oS).padStart(2, '0') : '超时 ' + oM + ':' + String(oS).padStart(2, '0');
  }
  const d = Math.floor(remaining / 86400), h = Math.floor((remaining % 86400) / 3600), m = Math.floor((remaining % 3600) / 60), s = remaining % 60;
  if (d > 0) return d + '天 ' + h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  if (m > 0) return m + ':' + String(s).padStart(2, '0');
  return s + '秒';
}

function getTimerClass(order) {
  return order.deliveryOverdue ? 'timer-overdue' : '';
}

function goDetail(id) {
  uni.navigateTo({ url: '/pages/order-detail/index?id=' + id });
}

async function fetchOrders() {
  loading.value = true;
  try {
    const [pubRes, recvRes] = await Promise.all([api.myPublished({}), api.myReceived({})]);
    published.value = (pubRes?.items || []).map(o => ({ ...o, _isPublished: true }));
    received.value = (recvRes?.items || []).map(o => ({ ...o, _isReceived: true }));
  } catch (e) {
    published.value = [];
    received.value = [];
  }
  loading.value = false;
}

onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 1000); fetchOrders(); });
onShow(() => fetchOrders());
onUnmounted(() => clearInterval(timer));
onPullDownRefresh(function(){ runPullDownRefresh(async function(){ uni.showLoading({ title: '刷新中' }); await fetchOrders(); uni.hideLoading(); }); });
</script>

<style scoped>
.page { min-height: 100vh; background: #F3F8FD; }

.header-wrapper { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: linear-gradient(160deg, #3E9BF0 0%, #63B5F6 50%, #9FD4FA 100%); }
.page-header { padding: 16rpx 32rpx 20rpx; }
.header-title { font-size: 40rpx; font-weight: 700; color: #fff; }
.header-tabs { display: flex; margin-top: 20rpx; }
.ht-item { flex: 1; text-align: center; padding: 14rpx 0; font-size: 28rpx; color: rgba(255,255,255,0.7); border-radius: 24rpx; background: rgba(255,255,255,0.15); margin-right: 16rpx; }
.ht-item:last-child { margin-right: 0; }
.ht-item.active { background: #fff; color: #3E9BF0; font-weight: 600; }

.page-body { padding-top: 240rpx; padding-bottom: 180rpx; }

.section { margin-bottom: 24rpx; }
.section-label { font-size: 28rpx; font-weight: 600; color: #8AA3B8; padding: 0 32rpx; margin-bottom: 16rpx; }

.order-card { position: relative; background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 16rpx; margin-left: 32rpx; margin-right: 32rpx; border: 1rpx solid #E3F1FD; box-shadow: 0 4rpx 20rpx rgba(62,155,240,0.06); }
.card-body { display: flex; flex-direction: column; gap: 12rpx; }
.type-row { display: flex; align-items: flex-start; gap: 12rpx; font-size: 28rpx; color: #2A4257; line-height: 1.5; }
.type-tag { flex-shrink: 0; font-size: 22rpx; padding: 4rpx 12rpx; border: 1rpx solid currentColor; border-radius: 6rpx; font-weight: 500; line-height: 1.4; margin-top: 4rpx; }
.tag-takeout { color: #3E9BF0; background: rgba(62,155,240,0.08); }
.tag-package { color: #2E8FD9; background: rgba(46,143,217,0.08); }
.tag-grocery { color: #26A69A; background: rgba(38,166,154,0.08); }
.tag-printing { color: #7986CB; background: rgba(121,134,203,0.08); }
.desc-text { flex: 1; word-break: break-all; }
.route-row { display: flex; align-items: center; gap: 10rpx; background: #F3F8FD; padding: 14rpx 18rpx; border-radius: 12rpx; font-size: 24rpx; color: #5A7A92; }
.route-from, .route-to { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.route-arrow { color: #3E9BF0; font-weight: 700; padding: 0 6rpx; }
.card-timer { position: absolute; top: 16rpx; right: 20rpx; font-size: 22rpx; font-weight: 600; color: #3E9BF0; background: #E3F1FD; padding: 4rpx 12rpx; border-radius: 8rpx; }
.card-timer.timer-overdue { color: #E57373; background: #FFEBEE; }
.card-foot { margin-top: 20rpx; display: flex; align-items: center; justify-content: space-between; }
.reward-num { font-size: 30rpx; font-weight: 700; color: #FF7043; }
.status-pill { font-size: 24rpx; padding: 8rpx 24rpx; border-radius: 999rpx; font-weight: 500; }
.status-waiting { background: #D6EBFD; color: #2A6CC5; }
.status-delivering { background: #FDF0D5; color: #B7791F; }
.status-completed { background: #E6F7EC; color: #2A9955; }
.status-expired { background: #f0f0f0; color: #999; }

.loading-state, .empty-state { text-align: center; padding: 100rpx 0; color: #8AA3B8; font-size: 28rpx; }
.empty-state { display: flex; flex-direction: column; align-items: center; }
.empty-emoji { font-size: 80rpx; margin-bottom: 16rpx; }
.empty-text { font-size: 28rpx; color: #8AA3B8; }

.safe-bottom { height: 60rpx; }
</style>