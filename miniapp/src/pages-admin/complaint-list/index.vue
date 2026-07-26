<template>
  <view class="page">
    <view class="title">投诉审核</view><view class="filters"><view v-for="option in options" :key="option.value" class="filter" :class="{ active: status === option.value }" @click="changeStatus(option.value)">{{ option.label }}</view></view>
    <view v-if="errorMessage" class="error-state">{{ errorMessage }}<button class="retry" @click="load(true)">重新加载</button></view><view v-else-if="!items.length && !loading" class="empty">暂无相关投诉</view>
    <view v-for="item in items" :key="item.complaintId" class="card" @click="detail(item.complaintId)">
      <view class="row"><strong>{{ item.orderSnapshot?.itemName || '订单投诉' }}</strong><text>{{ label(item.status) }}</text></view>
      <view class="muted">投诉人：{{ item.orderSnapshot?.publisherSnapshot?.displayName }} · 被投诉人：{{ item.orderSnapshot?.receiverSnapshot?.displayName }}</view>
      <view class="muted">{{ summary(item.reason) }}</view>
      <view class="row muted">
        <text>{{ formatDateTime(item.createdAt) }}</text>
        <text class="link" @click.stop="goOrder(item.orderId)">查看订单 ›</text>
      </view>
    </view>
    <view v-if="loading" class="empty">加载中…</view><view v-else-if="items.length && !hasMore" class="empty">没有更多了</view>
  </view>
</template>

<script setup>
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { api } from '../../utils/request';
import { formatDateTime } from '../../utils/orderDisplay';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
const items = ref([]); const status = ref('PENDING'); const page = ref(0); const hasMore = ref(true); const loading = ref(false); const errorMessage = ref('');
const options = [{ value: 'PENDING', label: '待审核' }, { value: 'UPHELD', label: '投诉成立' }, { value: 'DISMISSED', label: '投诉不成立' }];
async function load(reset = false) { if (loading.value || (!reset && !hasMore.value)) return; if (reset) { items.value = []; page.value = 0; hasMore.value = true; } loading.value = true; errorMessage.value=''; try { const result = await api.adminComplaints({ status: status.value, page: page.value }); items.value.push(...result.items); page.value += 1; hasMore.value = result.hasMore; } catch(error) { errorMessage.value=typeof error?.code==='string'&&error?.message?error.message:'加载失败，请稍后重试'; } finally { loading.value = false; } }
function changeStatus(value) { if (status.value === value) return; status.value = value; load(true); }
function label(v){return ({PENDING:'待审核',UPHELD:'投诉成立',DISMISSED:'投诉不成立'})[v]||''}
function summary(value) { const text = String(value || ''); return text.length > 30 ? `${text.slice(0, 30)}…` : text; }
function detail(complaintId) { const value=String(complaintId||'').trim();if(!value)return uni.showToast({title:'投诉信息无效',icon:'none'});uni.navigateTo({ url: `/pages-admin/complaint-detail/index?complaintId=${encodeURIComponent(value)}` }); }
function goOrder(orderId) { const value=String(orderId||'').trim();if(!value)return uni.showToast({title:'订单信息无效',icon:'none'});uni.navigateTo({ url: `/pages/order-detail/index?id=${encodeURIComponent(value)}&viewOnly=1` }); }
onShow(() => load(true)); onPullDownRefresh(() => runPullDownRefresh(() => load(true))); onReachBottom(() => load());
</script>
<style scoped>.filters{display:flex;gap:12rpx;margin-bottom:20rpx}.filter{flex:1;padding:16rpx 8rpx;text-align:center;background:#EAF4FD;color:#2E8FD9;border-radius:6px;font-size:26rpx}.filter.active{background:#3E9BF0;color:#fff}.card{line-height:1.8}.link{color:#3E9BF0;font-size:26rpx}.error-state{text-align:center;color:#a02b2b;padding:60rpx 0}.retry{width:220rpx;margin-top:20rpx;font-size:26rpx}</style>
