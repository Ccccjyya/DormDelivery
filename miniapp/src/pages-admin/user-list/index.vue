<template>
  <view class="page"><view class="title">用户资料管理</view>
    <view class="search-panel"><input class="input" v-model="keyword" placeholder="搜索姓名或学号" confirm-type="search" @confirm="applyFilters"/>
      <view class="filter-row"><picker class="filter-picker" :range="floorOptions" range-key="label" :value="floorIndex" @change="changeFloor"><view>{{ floorOptions[floorIndex]?.label || '全部楼层' }}</view></picker></view>
      <button class="btn search-button" @click="applyFilters">查询</button>
    </view>
    <view v-if="errorMessage" class="error-state">{{ errorMessage }}<button class="retry" @click="load(true)">重新加载</button></view><view v-else-if="!items.length&&!loading" class="empty">暂无本楼用户</view>
    <view v-for="user in items" :key="user.id" class="card" @click="goDetail(user.id)"><view class="row"><text class="name">{{ user.realName || '未填写姓名' }}</text><text class="status">{{ accountLabel(user.accountStatus) }}</text></view><view class="muted">学号：{{ user.studentNo || '未填写' }}</view><view class="muted">{{ user.dormSnapshot?.floorNo || '-' }}层 · {{ user.dormSnapshot?.roomNo || '-' }}号 · {{ roleLabel(user.role) }}</view><view class="muted">发单和接单：{{ businessLabel(user) }}</view></view>
    <view v-if="loading" class="empty">加载中…</view><view v-else-if="items.length&&!hasMore" class="end">没有更多了</view>
  </view>
</template>
<script setup>
import { onPullDownRefresh,onReachBottom,onShow } from '@dcloudio/uni-app';import { computed,ref } from 'vue';import { api } from '../../utils/request';import { runPullDownRefresh } from '../../utils/pullDownRefresh';
const items=ref([]),keyword=ref(''),floorNo=ref(null),floors=ref([]),page=ref(0),hasMore=ref(true),loading=ref(false),errorMessage=ref(''),initialized=ref(false);
const floorOptions=computed(()=>[{value:null,label:'全部楼层'},...floors.value.map(value=>({value,label:`${value}层`}))]);const floorIndex=computed(()=>Math.max(0,floorOptions.value.findIndex(item=>item.value===floorNo.value)));
async function prepare(){if(initialized.value)return;const me=await api.me();floors.value=await api.floors(me.dormBuildingId);initialized.value=true}
async function load(reset=false){if(loading.value||(!reset&&!hasMore.value))return;if(reset){items.value=[];page.value=0;hasMore.value=true}loading.value=true;errorMessage.value='';try{await prepare();const result=await api.adminUsers({page:page.value,keyword:keyword.value,floorNo:floorNo.value});items.value.push(...result.items);page.value+=1;hasMore.value=result.hasMore}catch(error){errorMessage.value=typeof error?.code==='string'&&error?.message?error.message:'加载失败，请稍后重试'}finally{loading.value=false}}
function changeFloor(event){floorNo.value=floorOptions.value[event.detail.value]?.value??null;load(true)}function applyFilters(){load(true)}
function goDetail(id){const userId=String(id||'').trim();if(!userId)return uni.showToast({title:'用户信息无效',icon:'none'});uni.navigateTo({url:`/pages-admin/user-detail/index?userId=${encodeURIComponent(userId)}`})}
function accountLabel(v){return v==='ACTIVE'?'账号正常':'账号禁用'}function roleLabel(v){return v==='ADMIN'?'管理员':'普通用户'}function businessLabel(user){if(user.publishBlocked||user.acceptBlocked)return'已禁止';return'允许'}
onShow(()=>{initialized.value=false;load(true)});onPullDownRefresh(()=>runPullDownRefresh(()=>{initialized.value=false;return load(true)}));onReachBottom(()=>load());
</script>
<style scoped>.search-panel{margin-bottom:20rpx}.filter-row{display:flex;gap:14rpx;margin-bottom:14rpx}.filter-picker{flex:1;padding:18rpx;background:#fff;border:1rpx solid #cfded9;border-radius:6px;color:#1d5b50;text-align:center}.search-button{margin:0}.name{font-weight:600}.card{line-height:1.8}.error-state{text-align:center;color:#a02b2b;padding:60rpx 0}.retry{width:220rpx;margin-top:20rpx;font-size:26rpx}.end{text-align:center;color:#6a7d76;padding:24rpx}</style>
