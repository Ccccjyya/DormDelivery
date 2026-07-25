<template>
  <view class="page">
    <view class="header-wrapper">
      <StatusBar />
      <view class="page-header">
        <view class="header-content">
          <view class="avatar-wrap">
            <view class="avatar-ring"></view>
            <view class="avatar">
              <view class="avatar-inner">
                <view class="avatar-face"></view>
              </view>
            </view>
          </view>
          <view class="user-info">
            <view class="username">{{ userInfo.nickname }}</view>
            <view class="user-detail">
              <view class="loc-icon"></view>
              <text>{{ userInfo.dormInfo }}</text>
            </view>
          </view>
          <view class="edit-btn" @click="goEdit">
            <view class="edit-icon"></view>
            <text>编辑资料</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page-body">
      <view class="stats-row">
        <view class="stat-card">
          <view class="stat-icon-wrap moon"><view class="stat-icon-inner"></view></view>
          <view class="stat-val">{{ userInfo.contribution }}</view>
          <view class="stat-label">贡献值</view>
        </view>
        <view class="stat-card">
          <view class="stat-icon-wrap level"><view class="stat-icon-inner"></view></view>
          <view class="stat-val">Lv.{{ userInfo.level }}</view>
          <view class="stat-label">等级</view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">我的订单</view>
        <view class="menu-card">
          <view class="menu-item" @click="navigateTo('/pages/my-published-orders/index')">
            <view class="mi mi-refresh"></view>
            <text class="menu-text">我发布的</text>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-item" @click="navigateTo('/pages/my-received-orders/index')">
            <view class="mi mi-check"></view>
            <text class="menu-text">我接到的</text>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-item" @click="navigateTo('/pages/complaint-list/index')">
            <view class="mi mi-clock"></view>
            <text class="menu-text">我的投诉</text>
            <text class="menu-arrow">›</text>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">我的记录</view>
        <view class="menu-card">
          <view class="menu-item" @click="navigateTo('/pages/contribution-records/index')">
            <view class="mi mi-star"></view>
            <text class="menu-text">贡献值记录</text>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-item" @click="navigateTo('/pages/weekly-quota/index')">
            <view class="mi mi-plus"></view>
            <text class="menu-text">发单次数记录</text>
            <text class="menu-arrow">›</text>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">更多</view>
        <view class="menu-card">
          <view class="menu-item" @click="navigateTo('/pages/announcement-list/index')">
            <view class="mi mi-bell"></view>
            <text class="menu-text">公告中心</text>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-item logout" @click="logout">
            <text class="menu-text logout-text">退出登录</text>
          </view>
        </view>
      </view>

      <view class="safe-bottom"></view>
    </view>

    <TabBar selected="profile" />
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
import TabBar from '@/components/TabBar.vue';
import StatusBar from '@/components/StatusBar.vue';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const userInfo = ref({
  nickname: '同学',
  dormInfo: 'B03栋 5楼 302',
  contribution: 60,
  remainingOrders: 3,
  level: 1
});

onShow(async () => {
  await userStore.fetchMe();
  const p = userStore.profile;
  if (p) {
    userInfo.value = {
      nickname: p.displayName || '同学',
      dormInfo: (p.dormBuildingName || '') + (p.floorNo ? ' ' + p.floorNo + 'F' : '') + (p.roomLabel ? ' ' + p.roomLabel : ''),
      contribution: p.contributionScore ?? 60,
      remainingOrders: p.remainingWeeklyQuota ?? 3,
      level: Math.floor((p.contributionScore || 0) / 100) + 1
    };
  }
});

onPullDownRefresh(function(){ runPullDownRefresh(async function(){ uni.showLoading({ title: '刷新中' }); await userStore.fetchMe(); uni.hideLoading(); }); });

function goEdit() { uni.navigateTo({ url: '/pages/profile-edit/index' }); }
function navigateTo(url) { uni.navigateTo({ url }); }
function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确认退出当前账号？',
    confirmText: '退出',
    confirmColor: '#E57373',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('token');
        uni.removeStorageSync('cloudProfile');
        uni.reLaunch({ url: '/pages/login/index' });
      }
    }
  });
}
</script>

<style scoped>
.page { min-height: 100vh; background: #F3F8FD; }

.header-wrapper { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: linear-gradient(160deg, #3E9BF0 0%, #63B5F6 50%, #9FD4FA 100%); }
.page-header { padding: 16rpx 32rpx 60rpx; }
.header-content { display: flex; align-items: center; gap: 20rpx; }

.avatar-wrap { flex-shrink: 0; position: relative; width: 120rpx; height: 120rpx; }
.avatar-ring { position: absolute; inset: 0; border-radius: 50%; border: 4rpx solid rgba(255,255,255,0.6); }
.avatar { position: absolute; inset: 6rpx; border-radius: 50%; background: rgba(255,255,255,0.35); overflow: hidden; }
.avatar-inner { width: 100%; height: 100%; display: flex; align-items: flex-end; justify-content: center; }
.avatar-face { width: 56rpx; height: 56rpx; border-radius: 50% 50% 40% 40%; background: rgba(255,255,255,0.9); }

.user-info { flex: 1; min-width: 0; }
.username { font-size: 36rpx; font-weight: 700; color: #fff; }
.user-detail { display: flex; align-items: center; gap: 6rpx; margin-top: 6rpx; font-size: 24rpx; color: rgba(255,255,255,0.9); }
.loc-icon { width: 14rpx; height: 14rpx; border: 2rpx solid #fff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); }

.edit-btn { display: flex; align-items: center; gap: 6rpx; font-size: 24rpx; color: #fff; background: rgba(255,255,255,0.25); padding: 10rpx 18rpx; border-radius: 22rpx; }
.edit-icon { width: 18rpx; height: 18rpx; border: 2rpx solid #fff; border-radius: 2rpx; }

.page-body { padding-top: 280rpx; padding-bottom: 180rpx; }

.stats-row { display: flex; gap: 16rpx; padding: 0 32rpx; margin-bottom: 32rpx; }
.stat-card { flex: 1; background: #fff; border-radius: 20rpx; padding: 20rpx 12rpx; text-align: center; border: 1rpx solid #E3F1FD; box-shadow: 0 4rpx 16rpx rgba(62,155,240,0.05); display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.stat-icon-wrap { width: 50rpx; height: 50rpx; border-radius: 50%; margin-bottom: 8rpx; display: flex; align-items: center; justify-content: center; }
.stat-icon-wrap.moon { background: #FFE0B2; }
.stat-icon-wrap.doc { background: #C5E1FF; }
.stat-icon-wrap.level { background: #B3D9FF; }
.stat-icon-inner { width: 26rpx; height: 26rpx; border-radius: 50%; background: #fff; }
.stat-icon-wrap.level .stat-icon-inner { border-radius: 4rpx; transform: rotate(45deg); }
.stat-val { font-size: 32rpx; font-weight: 700; color: #2A4257; }
.stat-label { font-size: 22rpx; color: #8AA3B8; }

.section { padding: 0 32rpx; margin-bottom: 32rpx; }
.section-title { font-size: 26rpx; color: #8AA3B8; margin-bottom: 14rpx; padding-left: 8rpx; }
.menu-card { background: #fff; border-radius: 20rpx; overflow: hidden; border: 1rpx solid #E3F1FD; box-shadow: 0 4rpx 16rpx rgba(62,155,240,0.05); }

.menu-item { display: flex; align-items: center; gap: 20rpx; padding: 30rpx 24rpx; border-bottom: 1rpx solid #F3F8FD; }
.menu-item:last-child { border-bottom: none; }
.mi { width: 36rpx; height: 36rpx; border-radius: 50%; flex-shrink: 0; }
.mi-refresh { background: #C5E1FF; }
.mi-check { background: #B3D9FF; }
.mi-clock { background: #FFE0B2; }
.mi-star { background: #C5E1FF; }
.mi-plus { background: #B3E5FC; }
.mi-bell { background: #FFE082; }
.menu-text { flex: 1; font-size: 30rpx; color: #2A4257; }
.logout-text { color: #E57373; font-weight: 500; }
.menu-arrow { font-size: 32rpx; color: #C0C0C0; }

.safe-bottom { height: 60rpx; }
</style>