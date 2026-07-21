<template>
  <view class="page">
    <view class="title">个人中心</view>
    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="errorMessage" class="empty">{{ errorMessage }}</view>
    <template v-else-if="me">
    <view class="card">
      <view class="profile-name">{{ me.realName }}</view>
      <view v-if="me.role === 'ADMIN'" class="admin-label">管理员</view>
      <view class="metrics">
        <view class="metric-item"><view class="muted">贡献值</view><view class="metric">{{ me.contributionScore }}</view></view>
        <view class="metric-item"><view class="muted">剩余发单</view><view><text class="metric">{{ me.postingQuota }}</text><text class="metric-unit">次</text></view></view>
      </view>
      <view class="dorm-label">{{ me.dormBuildingName }}·{{ me.floorNo }}层·{{ me.roomNo }}号</view>
    </view>
    <button class="btn" @click="nav('/pages/profile-edit/index')">编辑资料</button>
    <template v-if="me.role !== 'SUPER_ADMIN'">
      <button class="btn secondary" @click="nav('/pages/my-published-orders/index')">我的发单</button>
      <button class="btn secondary" @click="nav('/pages/my-received-orders/index')">我的接单</button>
      <button class="btn secondary" @click="nav('/pages/my-complaints/index')">我的投诉</button>
    </template>
    <button class="btn secondary" @click="nav('/pages/contribution-records/index')">贡献值记录</button>
    <button class="btn secondary" @click="nav('/pages/quota-records/index')">贡献值与发单次数</button>
    <button class="btn secondary" @click="nav('/pages/announcements/index')">公告中心</button>
    <button v-if="me.role === 'ADMIN'" class="btn secondary" @click="enterAdmin">进入管理端</button>
    <button v-if="me.role === 'SUPER_ADMIN'" class="btn secondary" @click="enterSuper">进入超级管理端</button>
    <button class="btn danger" @click="logout">退出登录</button>
    </template>
  </view>
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { useUserStore } from '../../stores/user';
import { syncRoleSurface } from '../../utils/roleNavigation';
import { safeReLaunch } from '../../utils/navigation';
const store = useUserStore();
const me = ref(store.profile || null);
const loading = ref(false);
const errorMessage = ref('');
const refreshing = ref(false);
onShow(async () => {
  if (refreshing.value) return;
  me.value = store.profile || me.value;
  loading.value = !me.value;
  errorMessage.value = '';
  refreshing.value = true;
  try { const auth=await syncRoleSurface(store,'USER');if(!auth.allowed)return;me.value = auth.profile; }
  catch (error) {
    if (!me.value) errorMessage.value = typeof error?.code === 'string' && error?.message ? error.message : '个人信息加载失败，请稍后重试';
  } finally { loading.value = false; refreshing.value = false; }
});
function nav(url) { uni.navigateTo({ url }); }
function enterAdmin() { safeReLaunch('/pages-admin/profile/index'); }
function enterSuper() { safeReLaunch('/pages-super/dashboard/index'); }
function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确认退出当前账号？',
    success: ({ confirm }) => { if (confirm) store.logout(); }
  });
}
</script>

<style scoped>
.profile-name { font-size: 32rpx; font-weight: 600; }
.metrics { display: flex; gap: 96rpx; margin: 28rpx 0 20rpx; }
.metric-item { min-width: 120rpx; }
.metric-unit { margin-left: 6rpx; color: #6a7d76; font-size: 24rpx; }
.dorm-label { color: #6a7d76; font-size: 26rpx; }
.admin-label{display:inline-block;margin-top:10rpx;padding:4rpx 12rpx;border-radius:6rpx;background:#e2f3ed;color:#0e6658;font-size:22rpx}
</style>
