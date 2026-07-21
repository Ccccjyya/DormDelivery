<template>
  <view class="page">
    <view class="login-title">宿舍楼互助取送平台</view>
    <view class="login-action">
      <button class="btn" :loading="loading" @click="login">微信授权登录</button>
    </view>
  </view>
</template>

<script setup>
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { useUserStore } from '../../stores/user';
import { routeForProfile } from '../../utils/roleNavigation';
import { safeReLaunch } from '../../utils/navigation';

const store = useUserStore();
const loading = ref(false);

async function login() {
  loading.value = true;
  try {
    const session = await store.loginWithWeChat();
    await routeAfterLogin(session);
  } finally {
    loading.value = false;
  }
}

async function routeAfterLogin(session) {
  if (session.needsProfile) {
    await safeReLaunch('/pages/register/index');
    return;
  }
  await safeReLaunch(routeForProfile(session.profile));
}

onLoad(async () => {
  if (uni.getStorageSync('accountDisabledExit')) {
    store.clearSession();
    uni.removeStorageSync('accountDisabledExit');
  }
  if (!store.profile || loading.value) return;
  loading.value = true;
  try {
    const profile = await store.fetchMe();
    await routeAfterLogin({ profile, needsProfile: !profile.profileCompleted });
  } catch {
    // Keep the login button available when a cached session is no longer usable.
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.login-title { margin-top: 180rpx; text-align: center; font-size: 44rpx; font-weight: 700; }
.login-action { margin-top: 80rpx; }
</style>
