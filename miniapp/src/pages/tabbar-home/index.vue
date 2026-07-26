<template>
  <view class="page">
    <view class="header-wrapper">
      <StatusBar />
    <view class="page-header">
        <view class="header-content">
          <view class="header-left">
            <view class="header-title">同学你好呀 👋</view>
            <view class="header-subtitle">
              <view class="location-badge" v-if="dormLabel">
                <view class="loc-icon"></view>
                <text>{{ dormLabel }}</text>
              </view>
              <text class="subtitle-text">今天有 {{ availableOrders.length }} 单顺路可接</text>
            </view>
          </view>
        </view>

        <view class="stats-row">
          <view class="stat-card stat-green">
            <view class="stat-title">今日赚取</view>
            <view class="stat-val">+{{ todayEarned }}</view>
          </view>
          <view class="stat-card stat-orange">
            <view class="stat-title">今日消耗</view>
            <view class="stat-val">-{{ todaySpent }}</view>
          </view>
          <view class="stat-card stat-blue">
            <view class="stat-title">总贡献值</view>
            <view class="stat-val">{{ totalScore }}</view>
          </view>
        </view>
      </view>
    </view>

    <view class="page-body">
      <view class="leaderboard-entry" @click="goLeaderboard">
        <text class="lb-icon">🏆</text>
        <text class="lb-text">贡献值排行榜</text>
        <text class="lb-arrow">›</text>
      </view>

      <view class="section">
        <view class="section-title">
          <text>可接订单</text>
          <text class="section-count">{{ filteredOrders.length }}</text>
        </view>

        <view class="filter-bar">
          <view class="filter-chip" :class="{ active: filterType === 'all' && !showFloorOnly }" @click="filterType = 'all'; showFloorOnly = false; applyFilter()">
            全部
          </view>
          <view class="filter-chip" :class="{ active: showFloorOnly }" @click="showFloorOnly = !showFloorOnly; applyFilter()">
            仅同层
          </view>
          <view
            v-for="ft in orderTypeFilters"
            :key="ft.key"
            class="filter-chip"
            :class="{ active: filterType === ft.key }"
            @click="filterType = ft.key; applyFilter()"
          >
            {{ ft.label }}
          </view>
        </view>

        <view v-if="filteredOrders.length === 0" class="empty-state">
          <text class="empty-emoji">🌟</text>
          <text class="empty-text">暂时没有可接订单</text>
          <text class="empty-hint">帮人送单就能赚贡献值哦</text>
        </view>
        <view v-for="order in filteredOrders" :key="order.id" class="order-card" @click="goDetail(order.id)">
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

      <view class="safe-bottom"></view>
    </view>

    <TabBar selected="home" />
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
import StatusBar from '@/components/StatusBar.vue';
import TabBar from '@/components/TabBar.vue';
import { api } from '@/utils/request';

const profile = uni.getStorageSync('cloudProfile') || {};
const dormLabel = profile.dormBuildingName
  ? (profile.dormBuildingName + (profile.floorNo ? ' ' + profile.floorNo + 'F' : ''))
  : '';
const totalScore = ref(profile.contributionScore ?? 60);
const todayEarned = ref(0);
const todaySpent = ref(0);
const availableOrders = ref([]);
const filteredOrders = ref([]);
const showFloorOnly = ref(false);
const filterType = ref('all');

const orderTypeFilters = [
  { key: 'takeout', label: '外卖' },
  { key: 'package', label: '快递' },
  { key: 'grocery', label: '帮买' },
  { key: 'printing', label: '打印' }
];

function applyFilter() {
  let items = availableOrders.value;
  if (filterType.value !== 'all') {
    items = items.filter(o => o.orderType === filterType.value);
  }
  if (showFloorOnly.value) {
    const pf = Number(profile.floorNo);
    items = items.filter(o => Number(o.publisherFloorNo) === pf);
  }
  filteredOrders.value = items;
}

const now = ref(Date.now());
let timer = 0;
const typeLabel = { takeout: '外卖', package: '快递', grocery: '帮买', printing: '打印' };

function getOrderLimit(o) {
  if (o.status === 'DELIVERING') return o.deliveryLimitMinutes ?? o.timeLimitMinutes ?? 720;
  return o.acceptLimitMinutes ?? o.timeLimitMinutes ?? 720;
}

function getTimerText(order) {
  if (order.withdrawn || order.status === 'COMPLETED' || order.status === 'EXPIRED') return '';
  if (getOrderLimit(order) >= 720) return '不限时';
  const ts = now.value;
  const deadline = order.status === 'WAITING' ? order.expiresAt : order.deliveryDeadline;
  if (!deadline) return '';
  const remaining = Math.floor((new Date(deadline).getTime() - ts) / 1000);
  if (remaining <= 0) {
    if (order.status === 'WAITING') return '已过期';
    const over = Math.abs(remaining);
    const oH = Math.floor(over / 3600), oM = Math.floor((over % 3600) / 60), oS = over % 60;
    return oH > 0 ? '超时 ' + oH + ':' + String(oM).padStart(2, '0') + ':' + String(oS).padStart(2, '0') : '超时 ' + oM + ':' + String(oS).padStart(2, '0');
  }
  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  if (d > 0) return d + '天 ' + h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  if (m > 0) return m + ':' + String(s).padStart(2, '0');
  return s + '秒';
}

function getTimerClass(order) {
  if (order.withdrawn || order.status === 'COMPLETED' || order.status === 'EXPIRED') return '';
  if (order.deliveryOverdue) return 'timer-overdue';
  return '';
}

const typeMap = {
  takeout:  { typeIcon: '🥡', typeClass: 'takeout' },
  package:  { typeIcon: '📦', typeClass: 'package' },
  grocery:  { typeIcon: '🏪', typeClass: 'grocery' },
  printing: { typeIcon: '🖨️', typeClass: 'printing' }
};

function goDetail(id) {
  uni.navigateTo({ url: `/pages/order-detail/index?id=${id}` });
}

function goLeaderboard() {
  uni.showToast({ title: '排行榜功能开发中', icon: 'none' });
}

async function fetchToday() {
  try {
    const result = await api.contributionRecords({ page: 0 });
    const items = result?.items || [];
    const today = new Date().toDateString();
    let earned = 0;
    let spent = 0;
    for (const r of items) {
      if (new Date(r.createdAt).toDateString() !== today) continue;
      if (r.changeType === 'ORDER_REWARD') earned += r.changeAmount;
      else if (r.changeType === 'ORDER_PUBLISH' || r.changeType === 'COMPLAINT_PENALTY') spent += Math.abs(r.changeAmount || 0);
    }
    todayEarned.value = earned;
    todaySpent.value = spent;
  } catch (e) {
    // 忽略
  }
}

async function fetchOrders() {
  try {
    const result = await api.availableOrders({ filterMode: 'ALL_FLOORS', page: 0 });
    const raw = (result?.items || []).map(function(order) {
      const pub = order.publisherSnapshot || {};
      const isStation = order.pickupMode === 'station';
      let displayText = order.orderDetail || order.itemName;
    if (order.orderType === 'printing') {
      const count = (order.imageFileIds && order.imageFileIds.length) || (order.orderDetail ? order.orderDetail.split(/[、,，]/).filter(Boolean).length : 0);
      displayText = count > 0 ? (count + '份文件要打印') : '帮打印';
    }
    return {
      typeName: { takeout: '外卖', package: '快递', grocery: '帮买', printing: '打印' }[order.orderType] || '外卖',
      displayText,
        routeFrom: (order.orderType === 'grocery' && order.pickupAddress) ? (order.itemName + '(' + order.pickupAddress + ')') : (order.itemName || (isStation ? '驿站' : '宿舍楼下')),
        routeTo: order.destinationLabel || pub.fullRoomLabel || '',
        statusText: '待接单',
        statusClass: 'waiting',
        rewardAmount: order.rewardAmount || 0,
        id: order.id,
        orderType: order.orderType,
        expiresAt: order.expiresAt,
        deliveryDeadline: order.deliveryDeadline,
        timeLimitMinutes: order.timeLimitMinutes,
        acceptLimitMinutes: order.acceptLimitMinutes,
        deliveryLimitMinutes: order.deliveryLimitMinutes,
        publisherFloorNo: pub.floorNo,
        withdrawn: order.withdrawn,
        status: order.status,
        deliveryOverdue: order.deliveryOverdue
      };
    });
    availableOrders.value = raw;
    updateTimers();
    applyFilter();
  } catch (e) {
    availableOrders.value = [];
  }
}

function updateTimers() {
  const ts = Date.now();
  availableOrders.value = availableOrders.value.map(function(o) {
    o.timerText = getTimerText(o);
    o.timerClass = getTimerClass(o);
    return o;
  });
}

async function refresh() {
  try {
    const p = await api.me();
    if (p) {
      totalScore.value = p.contributionScore ?? totalScore.value;
    }
  } catch (e) {}
  await Promise.all([fetchToday(), fetchOrders()]);
}

onMounted(() => {
  timer = setInterval(() => { now.value = Date.now(); updateTimers(); }, 1000);
  refresh();
});

onPullDownRefresh(function(){ runPullDownRefresh(async function(){ await refresh(); }); });
onUnmounted(() => { clearInterval(timer); });
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #F3F8FD;
}

.header-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: linear-gradient(160deg, #3E9BF0 0%, #63B5F6 50%, #9FD4FA 100%);
}

.page-header {
  padding: 16rpx 32rpx 40rpx;
}

.header-content {
  display: flex;
  align-items: center;
}

.header-left {
  flex: 1;
  min-width: 0;
}

.header-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
}

.header-subtitle {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 8rpx;
}

.subtitle-text {
  min-width: 0;
}

.location-badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  padding: 6rpx 18rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: #fff;
  border: 1rpx solid rgba(255, 255, 255, 0.3);
}

.loc-icon {
  width: 18rpx;
  height: 18rpx;
  border: 2rpx solid #fff;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
}

/* ---- 贡献值统计卡片 ---- */
.stats-row {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}

.stat-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  border-radius: 16rpx;
  padding: 20rpx 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.3);
}

.stat-title {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 6rpx;
}

.stat-val {
  font-size: 36rpx;
  font-weight: 800;
  color: #fff;
}

.page-body {
  padding-top: 380rpx;
}

.leaderboard-entry {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin: 28rpx 32rpx 0;
  padding: 22rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  border: 1rpx solid #E3F1FD;
  box-shadow: 0 2rpx 12rpx rgba(62, 155, 240, 0.06);
}

.lb-icon { font-size: 32rpx; }
.lb-text { flex: 1; font-size: 28rpx; font-weight: 500; color: #2A4257; }
.lb-arrow { font-size: 36rpx; color: #BCCFDE; }

.section {
  margin-top: 28rpx;
  padding: 0 32rpx;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #2A4257;
  margin-bottom: 20rpx;
}

.section-count {
  font-size: 22rpx;
  color: #3E9BF0;
  background: #E3F1FD;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.filter-bar {
  display: flex;
  gap: 14rpx;
  margin-bottom: 20rpx;
  flex-wrap: wrap;
}

.filter-chip {
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  border: 1rpx solid #C9DFF2;
  color: #8AA3B8;
  background: #fff;
  transition: all 0.15s;
}

.filter-chip.active {
  background: #3E9BF0;
  border-color: #3E9BF0;
  color: #fff;
  font-weight: 500;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 32rpx;
  background: #fff;
  border-radius: 20rpx;
  border: 1rpx dashed #C9DFF2;
}

.empty-emoji { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 30rpx; color: #2A4257; font-weight: 500; }
.empty-hint { font-size: 24rpx; color: #8AA3B8; margin-top: 12rpx; text-align: center; }

.order-card {
  position: relative;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid #E3F1FD;
  box-shadow: 0 4rpx 20rpx rgba(62, 155, 240, 0.06);
}

.card-timer {
  position: absolute;
  top: 16rpx;
  right: 20rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #3E9BF0;
  background: #E3F1FD;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.card-timer.timer-overdue {
  color: #E57373;
  background: #FFEBEE;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.type-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  font-size: 28rpx;
  color: #2A4257;
  line-height: 1.5;
}

.type-tag {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border: 1rpx solid currentColor;
  border-radius: 6rpx;
  font-weight: 500;
  line-height: 1.4;
  margin-top: 4rpx;
}

.type-tag.tag-takeout  { color: #3E9BF0; background: rgba(62, 155, 240, 0.08); }
.type-tag.tag-package  { color: #2E8FD9; background: rgba(46, 143, 217, 0.08); }
.type-tag.tag-grocery  { color: #26A69A; background: rgba(38, 166, 154, 0.08); }
.type-tag.tag-printing { color: #7986CB; background: rgba(121, 134, 203, 0.08); }

.desc-text {
  flex: 1;
  word-break: break-all;
}

.route-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: #F3F8FD;
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #5A7A92;
}

.route-from, .route-to {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.route-arrow {
  color: #3E9BF0;
  font-weight: 700;
  padding: 0 6rpx;
}

.card-foot {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.reward-num {
  font-size: 30rpx;
  font-weight: 700;
  color: #FF7043;
}

.status-pill {
  font-size: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 999rpx;
  font-weight: 500;
}

.status-pill.status-waiting    { background: #D6EBFD; color: #2A6CC5; }
.status-pill.status-delivering { background: #FDF0D5; color: #B7791F; }
.status-pill.status-completed  { background: #E6F7EC; color: #2A9955; }
.status-pill.status-expired    { background: #f0f0f0; color: #999; }

.safe-bottom {
  height: 180rpx;
}
</style>
