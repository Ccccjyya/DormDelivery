<template>
  <view class="page">
    <view class="title">接单率统计</view>
    <view class="tabs">
      <button
        v-for="item in periods"
        :key="item.value"
        class="tab"
        :class="{ active: period === item.value }"
        @click="changePeriod(item.value)"
      >{{ item.label }}</button>
    </view>
    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="errorMessage" class="error-state">
      <view>{{ errorMessage }}</view>
      <button class="retry" @click="load">重新加载</button>
    </view>
    <view v-else-if="stats" class="card stats">
      <view class="stat-row"><text>订单数（非下架）</text><text>{{ stats.nonOffShelfOrderCount ?? stats.eligibleOrderCount }}</text></view>
      <view class="stat-row"><text>接取订单数</text><text>{{ stats.acceptedCount }}</text></view>
      <view class="rate">{{ displayAcceptanceRate === null ? '暂无可统计订单' : `接单率 ${displayAcceptanceRate}%` }}</view>
    </view>
  </view>
</template>

<script setup>
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { api } from '../../utils/request';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
import { useUserStore } from '../../stores/user';
import { syncRoleSurface } from '../../utils/roleNavigation';

const periods = [
  { value: 'WEEK', label: '本周' },
  { value: '30_DAYS', label: '最近30天' },
  { value: 'ALL', label: '全部' }
];
const store = useUserStore();
const period = ref('WEEK');
const stats = ref(null);
const loading = ref(false);
const errorMessage = ref('');
const displayAcceptanceRate = computed(() => {
  if (!stats.value) return null;
  const total = Number(stats.value.nonOffShelfOrderCount ?? stats.value.eligibleOrderCount ?? 0);
  const accepted = Number(stats.value.acceptedCount || 0);
  return total > 0 ? Math.round(accepted * 100 / total) : null;
});

async function load() {
  if (loading.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const auth = await syncRoleSurface(store, 'SUPER');
    if (!auth.allowed) return;
    stats.value = await api.superAcceptanceStats(period.value);
  } catch (error) {
    console.error('acceptance stats load failed', {
      action: 'super.acceptanceStats',
      code: error?.code,
      message: error?.message
    });
    errorMessage.value = error?.message || '统计数据加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

async function changePeriod(value) {
  if (period.value === value || loading.value) return;
  period.value = value;
  stats.value = null;
  await load();
}

onShow(load);
onPullDownRefresh(() => runPullDownRefresh(load));
</script>

<style scoped>
.tabs{display:flex;gap:12rpx;margin-bottom:20rpx}.tab{flex:1;min-width:0;height:80rpx;padding:0 8rpx;background:#EAF4FD;color:#2E8FD9;font-size:26rpx}.tab.active{background:#3E9BF0;color:#fff}.tab::after{border:0}.stats{line-height:1.7}.stat-row{display:flex;align-items:center;justify-content:space-between;gap:20rpx;padding:14rpx 0}.stat-row text:first-child{min-width:0;flex:1}.stat-row text:last-child{flex:none}.rate{text-align:center;margin-top:24rpx;padding-top:22rpx;border-top:1rpx solid #D8E9F7;font-size:34rpx;font-weight:700;color:#3E9BF0}.error-state{text-align:center;color:#b42318;padding:70rpx 0}.retry{width:220rpx;margin-top:20rpx;font-size:26rpx}
</style>
