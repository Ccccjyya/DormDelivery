<template><view class="page"><view class="title">规则管理</view>
  <view v-if="loading" class="empty">规则加载中…</view>
  <view v-else-if="errorMessage" class="error-state"><view>{{ errorMessage }}</view><button class="retry" @click="load">重新加载</button></view>
  <template v-else-if="rules">
    <view v-for="item in menu" :key="item.path" class="rule-item" @click="open(item.path)"><view class="rule-title">{{ item.title }}</view><text class="arrow">›</text></view>
  </template>
</view></template>
<script setup>
import { ref } from 'vue';import { onShow } from '@dcloudio/uni-app';import { api } from '../../utils/request';import { useUserStore } from '../../stores/user';import { syncRoleSurface } from '../../utils/roleNavigation';
const store=useUserStore();const rules=ref(null);const loading=ref(false);const errorMessage=ref('');
const menu=[
  {title:'每周贡献值扣除规则',path:'/pages-super/contribution-rules/index'},
  {title:'每周发单次数规则',path:'/pages-super/quota-rules/index'},
  {title:'配送奖励规则',path:'/pages-super/reward-rule/index'},
  {title:'投诉处罚规则',path:'/pages-super/complaint-rule/index'},
  {title:'连续无配送处罚规则',path:'/pages-super/inactivity-rule/index'}];
async function load(){loading.value=true;errorMessage.value='';try{const auth=await syncRoleSurface(store,'SUPER');if(!auth.allowed)return;rules.value=await api.superRules()}catch(error){console.error('rule overview load failed',{action:'rule.get',page:'规则管理',code:error?.code,message:error?.message});errorMessage.value=error?.message||'规则加载失败，请稍后重试'}finally{loading.value=false}}
function open(path){uni.navigateTo({url:path})}onShow(load);
</script>
<style scoped>.rule-item{width:100%;min-height:92rpx;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;padding:20rpx 24rpx;margin-bottom:16rpx;background:#fff;border:1rpx solid #deebe7;border-radius:8px}.rule-title{min-width:0;flex:1;font-weight:600;font-size:29rpx}.arrow{flex-shrink:0;margin-left:18rpx;color:#6a7d76;font-size:42rpx}.error-state{text-align:center;color:#b42318;padding:70rpx 0}.retry{width:220rpx;margin-top:20rpx;font-size:26rpx}</style>
