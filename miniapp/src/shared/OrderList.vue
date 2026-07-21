<template>
  <view class="page">
    <view class="title">{{ title }}</view>
    <view v-if="errorMessage" class="empty">{{ errorMessage }}</view>
    <view v-else-if="items.length === 0 && !loading" class="empty">暂无数据</view>
    <view v-for="item in items" :key="item.id" class="card" @click="go(item.id)">
      <view class="row"><strong>{{ item.itemName }}</strong><text class="status">{{ getOrderStatusLabel(item) }}</text></view>
      <view class="muted">发布时间：{{ formatDateTime(item.createdAt) }}</view>
      <view v-if="item.overdue" class="muted">已超时</view>
    </view>
    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="items.length && !hasMore" class="end">没有更多了</view>
  </view>
</template>

<script setup>
import { onReachBottom, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { formatDateTime, getOrderStatusLabel } from '../utils/orderDisplay';
const props = defineProps({ title: String, loader: Function });
const items = ref([]);
const page = ref(0); const hasMore = ref(true); const loading = ref(false); const errorMessage = ref('');
async function load(reset = false) { if (loading.value || (!reset && !hasMore.value)) return; const requestPage = reset ? 0 : page.value; loading.value = true; errorMessage.value = ''; try { const result = await props.loader({ page: requestPage }); const nextItems = result.items || result; if (reset) items.value = [...nextItems]; else items.value.push(...nextItems); page.value = requestPage + 1; hasMore.value = result.hasMore === true; } catch (error) { errorMessage.value = typeof error?.code === 'string' && error?.message ? error.message : '加载失败，请稍后重试'; } finally { loading.value = false; } }
function go(id) { const value = String(id || '').trim(); if (!value) return uni.showToast({ title: '订单信息无效', icon: 'none' }); uni.navigateTo({ url: `/pages/order-detail/index?id=${encodeURIComponent(value)}` }); }
defineExpose({ refresh: () => load(true) });
onShow(() => load(true)); onReachBottom(() => load());
</script>

<style scoped>.end{text-align:center;color:#6a7d76;padding:24rpx}</style>
