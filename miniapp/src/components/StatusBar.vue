<template>
  <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
</template>

<script setup>
import { ref } from 'vue';

// 使用同步 API 确保首次渲染就能拿到正确的状态栏高度
const sysInfo = uni.getSystemInfoSync();
const statusBarHeight = ref(sysInfo.statusBarHeight || 20);
</script>

<style scoped>
.status-bar {
  width: 100%;
}
</style>
