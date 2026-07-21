<template>
  <view class="page"><view class="title">订单详情</view>
    <view v-if="errorMessage" class="empty">{{ errorMessage }}</view>
    <view v-else-if="order" class="card detail">
      <view>订单编号：{{ order.orderNo || '未记录' }}</view><view>物品信息：{{ order.itemName || '未记录' }}</view>
      <view>发布者：{{ order.publisherSnapshot?.displayName || '未记录' }}</view>
      <view>宿舍：{{ order.buildingName || '未记录' }} · {{ order.floorNo || '-' }}层 · {{ order.roomNo || '-' }}号</view>
      <view>创建时间：{{ formatDateTime(order.createdAt) }}</view>
    </view>
    <button v-if="order?.status==='WAITING'" class="btn danger" :loading="invalidating" @click="invalidate">下架</button>
  </view>
</template>
<script setup>
import { onLoad,onPullDownRefresh } from '@dcloudio/uni-app';import { ref } from 'vue';import { api } from '../../utils/request';import { formatDateTime } from '../../utils/orderDisplay';import { runPullDownRefresh } from '../../utils/pullDownRefresh';
const orderId=ref(''),order=ref(null),errorMessage=ref(''),invalidating=ref(false);
async function load(){try{errorMessage.value='';order.value=await api.adminOrderDetail(orderId.value)}catch(error){order.value=null;errorMessage.value=typeof error?.code==='string'&&error?.message?error.message:'加载失败，请稍后重试'}}
function confirmInvalidate(){return new Promise(resolve=>uni.showModal({title:'确认下架',content:'是否确认下架该订单？',editable:false,confirmText:'确定',cancelText:'取消',success:result=>resolve(result.confirm),fail:()=>resolve(false)}))}
async function invalidate(){if(invalidating.value)return;if(!await confirmInvalidate())return;invalidating.value=true;try{await api.adminInvalidateOrder({orderId:orderId.value,reason:'管理员下架订单'});uni.showToast({title:'订单已下架',icon:'success'});setTimeout(()=>uni.navigateBack(),500)}catch(error){if(['ORDER_EXPIRED','ORDER_DELIVERING','ORDER_COMPLETED'].includes(error?.code))setTimeout(()=>uni.navigateBack(),500)}finally{invalidating.value=false}}
onLoad(query=>{orderId.value=String(query.orderId||'').trim();if(!orderId.value){errorMessage.value='订单信息无效';return}load()});
onPullDownRefresh(()=>runPullDownRefresh(()=>orderId.value?load():undefined));
</script>
<style scoped>.detail{line-height:2}</style>
