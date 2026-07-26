<template>
  <view class="page">
    <view class="title">选择便利店</view>
    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="merchants.length === 0" class="empty">暂无可用便利店</view>
    <view v-else v-for="m in merchants" :key="m.merchantId" class="store-card" @click="selectStore(m)">
      <view class="sc-info">
        <text class="sc-name">{{ m.storeName }}</text>
        <text class="sc-addr">{{ m.storeAddress || '暂无位置信息' }}</text>
      </view>
      <text class="sc-arrow">›</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../../utils/request';

const merchants = ref([]);
const loading = ref(false);

onMounted(() => loadMerchants());

async function loadMerchants() {
  loading.value = true;
  try {
    const res = await api.groceryMerchantList();
    merchants.value = res?.items || [];
  } catch (e) { merchants.value = []; }
  loading.value = false;
}

function selectStore(m) {
  uni.navigateTo({ url: '/pages/task-publish-grocery/index?merchantId=' + m.merchantId + '&storeName=' + encodeURIComponent(m.storeName) + '&storeAddress=' + encodeURIComponent(m.storeAddress || '') });
}
</script>

<style scoped>
.page { min-height: 100vh; background: #F3F8FD; padding: 20rpx 32rpx; }
.title { font-size: 36rpx; font-weight: 700; color: #2A4257; margin-bottom: 24rpx; }
.empty { text-align: center; padding: 80rpx 0; color: #8AA3B8; font-size: 26rpx; }
.store-card { display: flex; align-items: center; gap: 20rpx; background: #fff; border-radius: 16rpx; padding: 28rpx 24rpx; margin-bottom: 16rpx; border: 1rpx solid #E3F1FD; }
.sc-icon { font-size: 44rpx; }
.sc-info { flex: 1; min-width: 0; }
.sc-name { font-size: 30rpx; font-weight: 600; color: #2A4257; display: block; }
.sc-addr { font-size: 24rpx; color: #8AA3B8; margin-top: 4rpx; display: block; }
.sc-arrow { font-size: 36rpx; color: #C2D2E3; }
</style>
