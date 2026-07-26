<template>
  <view class="page">
    <view class="title">发单接单统计</view>

    <view class="hero-section">
      <view class="hero-card">
        <text class="hero-num">{{ stats.publishedTotal }}</text>
        <text class="hero-label">总发单</text>
      </view>
      <view class="hero-card">
        <text class="hero-num">{{ stats.receivedTotal }}</text>
        <text class="hero-label">总接单</text>
      </view>
      <view class="hero-card">
        <text class="hero-num green">{{ stats.completedTotal }}</text>
        <text class="hero-label">已完成</text>
      </view>
    </view>

    <view class="score-card">
      <text class="score-label">总赚取贡献值</text>
      <text class="score-num">{{ stats.totalEarned }}</text>
      <text class="score-unit">分</text>
    </view>

    <!-- 趋势图 -->
    <view class="section-title">发单接单趋势</view>
    <view class="range-tabs">
      <view v-for="item in rangeOptions" :key="item.value" class="range-tab" :class="{ active: range === item.value }" @click="switchRange(item.value)">{{ item.label }}</view>
    </view>
    <view class="year-picker" @click="changeYear">
      <text>{{ selectedYear }} 年</text>
      <text class="yp-arrow">▾</text>
    </view>

    <view class="chart-area">
      <view class="chart-days" v-if="chartData.length">
        <view v-for="(day, idx) in chartData" :key="idx" class="chart-col">
          <view class="chart-nums-above">
            <text class="num-pub">{{ day.published || '' }}</text>
            <text class="num-rec">{{ day.received || '' }}</text>
          </view>
          <view class="chart-bars">
            <view class="bar-pub" :style="{ height: day.pubHeight + 'px' }"></view>
            <view class="bar-rec" :style="{ height: day.recHeight + 'px' }"></view>
          </view>
          <text class="day-label" v-if="shouldShowLabel(idx)">{{ day.label }}</text>
          <text v-else class="day-label-spacer"></text>
        </view>
      </view>
      <view v-else class="chart-empty">暂无数据</view>
      <view class="chart-legend">
        <view class="leg-item"><view class="leg-color pub"></view><text>发单</text></view>
        <view class="leg-item"><view class="leg-color rec"></view><text>接单</text></view>
      </view>
    </view>

    <view class="summary-row">
      <view class="sum-item">
        <text class="sum-num">{{ stats.rangePublished }}</text>
        <text class="sum-label">{{ rangeLabel }}发单</text>
      </view>
      <view class="sum-item">
        <text class="sum-num">{{ stats.rangeReceived }}</text>
        <text class="sum-label">{{ rangeLabel }}接单</text>
      </view>
    </view>

    <view v-if="errorMessage" class="error-msg">{{ errorMessage }}</view>
    <view v-if="loading" class="loading">加载中…</view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../utils/request';

const stats = ref({
  publishedTotal: 0, receivedTotal: 0, completedTotal: 0,
  totalEarned: 0, rangePublished: 0, rangeReceived: 0
});
const chartData = ref([]);
const loading = ref(true);
const errorMessage = ref('');
const range = ref('7');
const selectedYear = ref(new Date().getFullYear());

const rangeOptions = [
  { value: '7', label: '近7天' },
  { value: '30', label: '近30天' },
  { value: 'year', label: '本年' }
];

const rangeLabel = computed(() => {
  const m = { '7': '近7天', '30': '近30天', 'year': '本年' };
  return m[range.value] || '';
});

function shouldShowLabel(idx) {
  const total = chartData.value.length;
  if (range.value === '7') return true;
  if (range.value === '30') return idx === 0 || idx === total - 1 || (idx + 1) % 5 === 0;
  if (range.value === 'year') return true;
  return true;
}

const BAR_MAX = 90;

function changeYear() {
  const years = [];
  const now = new Date().getFullYear();
  for (let y = now; y >= now - 3; y--) years.push(String(y));
  uni.showActionSheet({
    itemList: years.map(y => y + '年'),
    success: (res) => {
      selectedYear.value = parseInt(years[res.tapIndex]);
      loadChart();
    }
  });
}

function switchRange(val) {
  range.value = val;
  loadChart();
}

async function loadChart() {
  try {
    let days, startDate;
    const now = new Date();
    if (range.value === '7') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      days = buildDayArray(startDate, 7);
    } else if (range.value === '30') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      days = buildDayArray(startDate, 30);
    } else {
      // year mode - show months
      const year = selectedYear.value;
      const monthData = [];
      for (let m = 0; m < 12; m++) {
        monthData.push({ label: (m + 1) + '月', published: 0, received: 0 });
      }
      // 获取该年的所有订单
      const [pub, recv] = await loadOrders(year);
      countEvents(pub, 'published', monthData, 'month');
      countEvents(recv, 'received', monthData, 'month');
      renderChart(monthData);
      return;
    }
    days.forEach(d => { d.published = 0; d.received = 0; });
    const [pub, recv] = await loadAllOrders();
    countEvents(pub, 'published', days);
    countEvents(recv, 'received', days);
    renderChart(days);
  } catch (e) {
    errorMessage.value = '加载失败';
  }
}

async function loadOrders(year) {
  const from = new Date(year, 0, 1).toISOString();
  const to = new Date(year, 11, 32).toISOString();
  // We load all orders from myPublished/myReceived and filter by year
  // Since the API doesn't support date filtering, we just load a large page
  const results = [[], []];
  try { const r = await api.myPublished({ page: 0 }); if (r?.items) results[0] = r.items; } catch (e) {}
  try { const r = await api.myReceived({ page: 0 }); if (r?.items) results[1] = r.items; } catch (e) {}
  return results;
}

async function loadAllOrders() {
  const results = [[], []];
  for (let p = 0; p < 5; p++) {
    let added = false;
    try { const r = await api.myPublished({ page: p }); if (r?.items && r.items.length) { results[0].push(...r.items); added = true; } } catch (e) {}
    try { const r = await api.myReceived({ page: p }); if (r?.items && r.items.length) { results[1].push(...r.items); added = true; } } catch (e) {}
    if (!added) break;
  }
  return results;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function countEvents(items, field, days, mode) {
  const dayMap = new Map();
  days.forEach(d => dayMap.set(d.key || d.label, d));
  (items || []).forEach(o => {
    const t = new Date(o.createdAt);
    let key;
    if (mode === 'month') key = (t.getMonth() + 1) + '月';
    else key = toDateKey(t);
    const found = dayMap.get(key);
    if (found) found[field] = (found[field] || 0) + 1;
  });
}

function buildDayArray(start, count) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({
      label: (d.getMonth() + 1) + '/' + d.getDate(),
      key: toDateKey(d),
      published: 0,
      received: 0
    });
  }
  return days;
}

function renderChart(data) {
  let max = 1;
  data.forEach(d => { max = Math.max(max, d.published, d.received); });
  chartData.value = data.map(d => ({
    ...d,
    pubHeight: d.published > 0 ? Math.max(8, Math.round((d.published / max) * BAR_MAX)) : 0,
    recHeight: d.received > 0 ? Math.max(8, Math.round((d.received / max) * BAR_MAX)) : 0
  }));
  // summary
  let pubSum = 0, recSum = 0;
  data.forEach(d => { pubSum += d.published; recSum += d.received; });
  stats.value.rangePublished = pubSum;
  stats.value.rangeReceived = recSum;
}

onMounted(async () => {
  try {
    const [pub, recv] = await Promise.all([
      api.myPublished({ page: 0 }),
      api.myReceived({ page: 0 })
    ]);
    stats.value.publishedTotal = pub?.total ?? pub?.items?.length ?? 0;
    stats.value.receivedTotal = recv?.total ?? recv?.items?.length ?? 0;
    let completed = 0, totalEarned = 0;
    if (pub?.items) { const c = pub.items.filter(o => o.status === 'COMPLETED'); completed += c.length; c.forEach(o => { totalEarned += o.rewardAmount || 0; }); }
    if (recv?.items) { const c = recv.items.filter(o => o.status === 'COMPLETED'); completed += c.length; c.forEach(o => { totalEarned += o.rewardAmount || 0; }); }
    stats.value.completedTotal = completed;
    stats.value.totalEarned = totalEarned;
    await loadChart();
  } catch (e) {
    errorMessage.value = '加载失败';
  }
  loading.value = false;
});
</script>

<style scoped>
.page { min-height: 100vh; background: #F3F8FD; padding: 24rpx; }
.title { font-size: 36rpx; font-weight: 700; color: #2A4257; text-align: center; padding: 20rpx 0 24rpx; }

.hero-section { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.hero-card { flex: 1; background: #fff; border-radius: 16rpx; padding: 28rpx 16rpx; text-align: center; border: 1rpx solid #E3F1FD; }
.hero-num { font-size: 44rpx; font-weight: 700; color: #2A4257; display: block; }
.hero-num.green { color: #4CAF50; }
.hero-label { font-size: 22rpx; color: #999; display: block; margin-top: 6rpx; }

.score-card { background: linear-gradient(135deg, #3E9BF0, #63B5F6); border-radius: 20rpx; padding: 32rpx; text-align: center; margin-bottom: 32rpx; }
.score-label { font-size: 24rpx; color: rgba(255,255,255,0.8); display: block; }
.score-num { font-size: 64rpx; font-weight: 700; color: #fff; display: block; margin: 8rpx 0; }
.score-unit { font-size: 28rpx; color: rgba(255,255,255,0.7); }

.section-title { font-size: 28rpx; font-weight: 600; color: #2A4257; margin-bottom: 12rpx; }

.range-tabs { display: flex; gap: 12rpx; margin-bottom: 12rpx; }
.range-tab { flex: 1; padding: 14rpx 0; text-align: center; background: #EAF4FD; color: #2E8FD9; border-radius: 10rpx; font-size: 26rpx; }
.range-tab.active { background: #3E9BF0; color: #fff; font-weight: 600; }

.year-picker { display: flex; align-items: center; justify-content: center; gap: 6rpx; padding: 12rpx; background: #fff; border-radius: 10rpx; border: 1rpx solid #E3F1FD; margin-bottom: 16rpx; font-size: 26rpx; color: #2A4257; }
.yp-arrow { font-size: 20rpx; color: #999; }

.chart-area { background: #fff; border-radius: 16rpx; padding: 24rpx 8rpx; margin-bottom: 24rpx; }
.chart-days { display: flex; justify-content: space-around; align-items: flex-end; height: 260rpx; padding-top: 20rpx; }
.chart-col { display: flex; flex-direction: column; align-items: center; height: 100%; flex: 1; min-width: 0; }
.chart-nums-above { height: 32rpx; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
.num-pub { font-size: 15rpx; color: #3E9BF0; font-weight: 600; }
.num-rec { font-size: 15rpx; color: #FF7043; font-weight: 600; }
.chart-bars { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 180rpx; gap: 2rpx; margin-top: 2rpx; }
.bar-pub { width: 10rpx; background: #3E9BF0; border-radius: 3rpx 3rpx 0 0; min-width: 10rpx; transition: height 0.5s; }
.bar-rec { width: 10rpx; background: #FF7043; border-radius: 3rpx 3rpx 0 0; min-width: 10rpx; transition: height 0.5s; }
.day-label { font-size: 15rpx; color: #999; margin-top: 8rpx; }
.day-label-spacer { height: 18rpx; display: block; }
.chart-empty { text-align: center; color: #999; padding: 60rpx 0; }
.chart-legend { display: flex; justify-content: center; gap: 40rpx; margin-top: 16rpx; }
.leg-item { display: flex; align-items: center; gap: 8rpx; font-size: 22rpx; color: #666; }
.leg-color { width: 24rpx; height: 24rpx; border-radius: 6rpx; }
.leg-color.pub { background: #3E9BF0; }
.leg-color.rec { background: #FF7043; }

.summary-row { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.sum-item { flex: 1; background: #fff; border-radius: 16rpx; padding: 24rpx; text-align: center; border: 1rpx solid #E3F1FD; }
.sum-num { font-size: 36rpx; font-weight: 700; color: #FF7043; display: block; }
.sum-label { font-size: 22rpx; color: #999; margin-top: 4rpx; display: block; }

.error-msg { text-align: center; color: #E57373; padding: 40rpx 0; }
.loading { text-align: center; color: #999; padding: 40rpx 0; }
</style>
