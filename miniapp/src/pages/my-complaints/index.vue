<template>
  <view class="page">
    <view class="title">我的投诉</view>
    <view v-if="!items.length && !loading" class="empty">暂无投诉记录</view>
    <view v-for="item in items" :key="item.id" class="card" @click="goDetail(item.id)">
      <view class="row"><text class="item-name">{{ item.itemName || '订单投诉' }}</text><text class="status">{{ statusLabel(item.status) }}</text></view>
      <view class="muted">被投诉人：{{ item.respondentName || '暂未记录' }}</view>
      <view class="muted">{{ summary(item.reason) }}</view>
      <view class="muted">投诉时间：{{ formatDateTime(item.createdAt) }}</view>
      <view v-if="item.reviewedAt" class="muted">审核时间：{{ formatDateTime(item.reviewedAt) }}</view>
    </view>
    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="items.length && !hasMore" class="empty">没有更多了</view>
  </view>
</template>

<script setup>
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { api } from '../../utils/request';
import { formatDateTime } from '../../utils/orderDisplay';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
const items = ref([]); const page = ref(0); const hasMore = ref(true); const loading = ref(false);
function statusLabel(value) { return ({ PENDING: '待审核', UPHELD: '投诉成立', DISMISSED: '投诉不成立' })[value] || '待审核'; }
function summary(value) { const text = String(value || ''); return text.length > 26 ? `${text.slice(0, 26)}…` : text; }
async function load(reset = false) { if (loading.value || (!reset && !hasMore.value)) return; if (reset) { page.value = 0; hasMore.value = true; items.value = []; } loading.value = true; try { const result = await api.myComplaints({ page: page.value }); items.value.push(...result.items); page.value += 1; hasMore.value = result.hasMore; } finally { loading.value = false; } }
function goDetail(id) { uni.navigateTo({ url: `/pages/complaint-detail/index?complaintId=${encodeURIComponent(id)}` }); }
onShow(() => load(true)); onPullDownRefresh(() => runPullDownRefresh(() => load(true))); onReachBottom(() => load());
</script>

<style scoped>.item-name{font-weight:600}.card{line-height:1.8}</style>
