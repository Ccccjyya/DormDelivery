<template>
  <view class="page">
    <view class="title">管理中心</view>
    <view class="card admin-card">
      <view class="admin-name">{{ me?.realName || '管理员' }}</view>
      <view class="admin-building">{{ me?.dormBuildingName || '宿舍楼信息加载中' }}</view>
    </view>
    <button class="btn secondary" @click="goOrders">订单管理</button>
    <button class="btn secondary" @click="goComplaints">投诉审核</button>
    <button class="btn secondary" @click="goUsers">用户资料管理</button>
    <button class="btn secondary" @click="goOperationRecords">我的业务操作记录</button>
    <button class="btn" @click="backToUser">返回普通用户端</button>
  </view>
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { api } from '../../utils/request';
import { useUserStore } from '../../stores/user';
import { syncRoleSurface } from '../../utils/roleNavigation';
import { safeReLaunch } from '../../utils/navigation';
const me = ref(null);
const store=useUserStore();
onShow(async () => { const auth=await syncRoleSurface(store,'ADMIN');if(auth.allowed)me.value=auth.profile; });
function openPage(url) { uni.navigateTo({ url }); }
function goOrders() { openPage('/pages-admin/order-list/index?entry=admin-center'); }
function goComplaints() { openPage('/pages-admin/complaint-list/index'); }
function goUsers() { openPage('/pages-admin/user-list/index'); }
function goOperationRecords() { openPage('/pages-admin/operation-records/index'); }
function backToUser() { safeReLaunch('/pages/home/index'); }
</script>

<style scoped>.admin-card{line-height:1.8}.admin-name{font-size:32rpx;font-weight:600}.admin-building{color:#334a43}</style>
