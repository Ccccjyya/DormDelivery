<template>
  <view class="page"><view class="title">贡献值记录</view>
    <view v-if="!items.length && !loading" class="empty">暂无贡献值记录</view>
    <view v-for="item in items" :key="item._id" class="card record"><view class="row"><text>{{ typeLabel(item.changeType) }}</text><text :class="item.changeAmount >= 0 ? 'positive' : 'negative'">{{ amount(item.changeAmount) }}</text></view>
      <view class="muted">变更前：{{ item.beforeValue }}　变更后：{{ item.afterValue }}</view><view v-if="item.relatedOrderId" class="order-link" @click="openOrder(item.relatedOrderId)"><text>关联订单：{{ item.relatedOrderItemName || '订单详情' }}</text><text>查看</text></view><view class="muted">{{ formatDateTime(item.createdAt) }}</view></view>
    <view v-if="loading" class="empty">加载中…</view><view v-else-if="items.length && !hasMore" class="empty">没有更多了</view>
  </view>
</template>
<script setup>
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'; import { ref } from 'vue'; import { api } from '../../utils/request'; import { formatDateTime } from '../../utils/orderDisplay'; import { runPullDownRefresh } from '../../utils/pullDownRefresh';
const items=ref([]),page=ref(0),hasMore=ref(true),loading=ref(false); function typeLabel(type){return ({ORDER_REWARD:'完成订单贡献值',COMPLAINT_PENALTY:'投诉成立扣减',WEEKLY_DEDUCTION:'每周贡献值结算'})[type]||'贡献值变更'} function amount(value){const number=Number(value)||0;return `${number>0?'+':''}${number}`}
function openOrder(orderId){if(!orderId)return;uni.navigateTo({url:`/pages/order-detail/index?id=${encodeURIComponent(orderId)}`})}
async function load(reset=false){if(loading.value||(!reset&&!hasMore.value))return;if(reset){items.value=[];page.value=0;hasMore.value=true}loading.value=true;try{const result=await api.contributionRecords({page:page.value});items.value.push(...result.items);page.value+=1;hasMore.value=result.hasMore}finally{loading.value=false}}
onShow(()=>load(true));onPullDownRefresh(()=>runPullDownRefresh(()=>load(true)));onReachBottom(()=>load());
</script>
<style scoped>.record{line-height:1.8}.positive{color:#147a69;font-weight:700}.negative{color:#dc2626;font-weight:700}.order-link{display:flex;align-items:center;justify-content:space-between;color:#147a69}</style>
