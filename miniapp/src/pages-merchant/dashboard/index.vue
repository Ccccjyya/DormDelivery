<template>
  <view class="page">
    <view class="title">商家中心</view>
    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="errorMessage" class="error-state">
      <view>{{ errorMessage }}</view>
      <button class="retry" @click="loadIdentity">重新加载</button>
    </view>
    <template v-else>
      <!-- 审核进度模块 -->
      <view class="card">
        <view class="card-title">审核进度</view>
        <view v-if="application" class="app-info">
          <view class="status-badge" :class="'s-' + application.status">
            {{ application.status === 'PENDING' ? '审核中' : application.status === 'APPROVED' ? '已通过' : '已拒绝' }}
          </view>
          <view class="info-row"><text class="lbl">便利店：</text><text class="vl">{{ application.storeName }}</text></view>
          <view class="info-row"><text class="lbl">联系人：</text><text class="vl">{{ application.contactName }}</text></view>
          <view class="info-row"><text class="lbl">手机号：</text><text class="vl">{{ application.phone }}</text></view>
          <view class="info-row"><text class="lbl">位置：</text><text class="vl">{{ application.storeAddress }}</text></view>
          <view class="info-row" v-if="application.description">
            <text class="lbl">说明：</text><text class="vl">{{ application.description }}</text>
          </view>
          <view class="info-row"><text class="lbl">提交时间：</text><text class="vl">{{ formatTime(application.createdAt) }}</text></view>
        </view>
        <view v-else class="no-app">暂无审核记录，请先提交申请</view>
      </view>

      <!-- 仅审核通过后才显示管理入口 -->
      <navigator v-if="isApproved" class="menu-button" url="/pages-merchant/grocery-products/index" hover-class="menu-button-active">便利店商品管理</navigator>
      <button class="btn danger logout-button" @click="confirmLogout">退出登录</button>
    </template>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '../../stores/user';
import { syncRoleSurface } from '../../utils/roleNavigation';
import { safeReLaunch } from '../../utils/navigation';
import { api } from '../../utils/request';

const store = useUserStore();
const loading = ref(false);
const errorMessage = ref('');
const application = ref(null);

const isApproved = computed(() => {
  const p = store.profile || uni.getStorageSync('cloudProfile') || {};
  return p.role === 'MERCHANT';
});

onMounted(async () => {
  await loadIdentity();
  if (!errorMessage.value) loadApplication();
});

async function loadIdentity() {
  loading.value = true; errorMessage.value = '';
  try {
    await store.fetchMe();
    const profile = store.profile || uni.getStorageSync('cloudProfile') || {};
    // Allow MERCHANT and users with pending applications
    if (profile.role !== 'MERCHANT') {
      await loadApplication();
      if (!application.value) {
        await safeReLaunch('/pages/tabbar-home/index');
        return;
      }
    }
  } catch (error) {
    console.error('merchant dashboard auth failed', error);
    errorMessage.value = error?.message || '加载失败';
  } finally { loading.value = false; }
}

async function loadApplication() {
  try {
    const res = await api.merchantMyApplication();
    application.value = res;
  } catch (e) {
    // No application yet, it's ok for approved merchants
  }
}

function confirmLogout() {
  uni.showModal({
    title: '退出登录', content: '确认退出当前账号？',
    success: ({ confirm }) => { if (!confirm) return; store.clearSession(); safeReLaunch('/pages/login/index'); }
  });
}

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  return d.getFullYear() + '-' + (d.getMonth()+1).toString().padStart(2,'0') + '-' + d.getDate().toString().padStart(2,'0') + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}
</script>

<style scoped>
.page { min-height: 100vh; background: #F3F8FD; padding: 20rpx 32rpx; padding-bottom: 100rpx; }
.title { font-size: 36rpx; font-weight: 700; color: #2A4257; margin-bottom: 24rpx; }
.card { background: #fff; border-radius: 14rpx; padding: 28rpx; margin-bottom: 24rpx; }
.card-title { font-size: 30rpx; font-weight: 600; color: #2A4257; margin-bottom: 16rpx; }
.status-badge { display: inline-block; padding: 8rpx 24rpx; border-radius: 10rpx; font-size: 24rpx; font-weight: 600; margin-bottom: 16rpx; }
.s-PENDING { background: #FDF0D5; color: #B7791F; }
.s-APPROVED { background: #E6F7EC; color: #2A9955; }
.s-REJECTED { background: #f0f0f0; color: #999; }
.info-row { margin-bottom: 12rpx; display: flex; }
.lbl { font-size: 26rpx; color: #8AA3B8; min-width: 120rpx; }
.vl { font-size: 26rpx; color: #2A4257; }
.no-app { text-align: center; padding: 40rpx 0; color: #8AA3B8; font-size: 26rpx; }

.menu-button { width: 100%; height: 92rpx; display: flex; align-items: center; justify-content: center; box-sizing: border-box; margin: 14rpx 0; border-radius: 6px; background: #EAF4FD; color: #2E8FD9; font-size: 30rpx; }
.menu-button-active { background: #dcece7; }
.logout-button { margin-top: 28rpx; }
.error-state { text-align: center; color: #b42318; padding: 70rpx 0; }
.retry { width: 220rpx; margin-top: 20rpx; font-size: 26rpx; }
.empty { text-align: center; color: #8AA3B8; padding: 80rpx 0; }
</style>
