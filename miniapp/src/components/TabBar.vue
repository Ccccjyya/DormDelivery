<template>
  <view class="tabbar">
    <view class="tabbar-bg"></view>
    <view class="tabbar-items">
      <view
        v-for="(item, index) in leftItems"
        :key="item.key"
        class="tab-item"
        :class="{ active: selected === item.key }"
        @click="switchTab(item.key)"
      >
        <view class="tab-icon" :class="item.iconClass"></view>
        <view class="tab-label">{{ item.label }}</view>
      </view>

      <view class="tab-item center-btn" @click="openPublish">
        <view class="center-circle">
          <view class="center-plus-h"></view>
          <view class="center-plus-v"></view>
        </view>
      </view>

      <view
        v-for="(item, index) in rightItems"
        :key="item.key"
        class="tab-item"
        :class="{ active: selected === item.key }"
        @click="switchTab(item.key)"
      >
        <view class="tab-icon" :class="item.iconClass"></view>
        <view class="tab-label">{{ item.label }}</view>
      </view>
    </view>

    <TaskTypeSheet v-if="showSheet" @close="showSheet = false" @select="handleSelect" />
  </view>
</template>

<script setup>
import { ref } from 'vue';
import TaskTypeSheet from './TaskTypeSheet.vue';

const props = defineProps({
  selected: {
    type: String,
    default: 'home'
  }
});

const emit = defineEmits(['changeTab', 'publish']);

const showSheet = ref(false);

const leftItems = [
  { key: 'home', iconClass: 'icon-home', label: '首页', path: '/pages/tabbar-home/index' },
  { key: 'orders', iconClass: 'icon-orders', label: '订单', path: '/pages/tabbar-orders/index' }
];

const rightItems = [
  { key: 'messages', iconClass: 'icon-messages', label: '消息', path: '/pages/tabbar-messages/index' },
  { key: 'profile', iconClass: 'icon-profile', label: '我的', path: '/pages/tabbar-profile/index' }
];

function switchTab(key) {
  if (key === props.selected) return;

  const allItems = [...leftItems, ...rightItems];
  const item = allItems.find(i => i.key === key);
  if (item) {
    uni.switchTab({ url: item.path });
    emit('changeTab', key);
  }
}

function openPublish() {
  showSheet.value = true;
}

function handleSelect(type) {
  showSheet.value = false;
  const pageMap = {
    takeout: '/pages/task-publish-takeout/index',
    package: '/pages/task-publish-package/index',
    grocery: '/pages/task-publish-grocery/index',
    printing: '/pages/task-publish-printing/index'
  };
  const url = pageMap[type];
  if (url) uni.navigateTo({ url });
  emit('publish', type);
}
</script>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.tabbar-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: #fff;
  box-shadow: 0 -4rpx 24rpx rgba(62, 155, 240, 0.08);
}

.tabbar-items {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 140rpx;
  padding-bottom: env(safe-area-inset-bottom);
  background: #fff;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 12rpx 0;
  height: 100%;
}

.tab-icon {
  width: 48rpx;
  height: 48rpx;
  position: relative;
}

.icon-home {
  border: 3rpx solid #8AA3B8;
  border-top: none;
  border-radius: 0 0 8rpx 8rpx;
}

.icon-home::before {
  content: '';
  position: absolute;
  top: -16rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 26rpx solid transparent;
  border-right: 26rpx solid transparent;
  border-bottom: 20rpx solid #8AA3B8;
}

.icon-home::after {
  content: '';
  position: absolute;
  bottom: -3rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 16rpx;
  height: 18rpx;
  border: 3rpx solid #8AA3B8;
  border-top: none;
  border-radius: 0 0 4rpx 4rpx;
  background: #fff;
}

.icon-orders {
  border: 3rpx solid #8AA3B8;
  border-radius: 6rpx;
}

.icon-orders::after {
  content: '';
  position: absolute;
  top: 12rpx;
  left: 10rpx;
  right: 10rpx;
  height: 3rpx;
  background: #8AA3B8;
  box-shadow: 0 10rpx 0 #8AA3B8, 0 20rpx 0 #8AA3B8;
}

.icon-messages {
  border: 3rpx solid #8AA3B8;
  border-radius: 50%;
}

.icon-messages::after {
  content: '';
  position: absolute;
  bottom: 6rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 20rpx;
  height: 14rpx;
  border: 3rpx solid #8AA3B8;
  border-top: none;
  border-radius: 0 0 20rpx 20rpx;
}

.icon-profile {
  border: 3rpx solid #8AA3B8;
  border-radius: 50%;
}

.icon-profile::after {
  content: '';
  position: absolute;
  top: 8rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 18rpx;
  height: 18rpx;
  border: 3rpx solid #8AA3B8;
  border-radius: 50%;
  background: #fff;
}

.icon-profile::before {
  content: '';
  position: absolute;
  bottom: 4rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 30rpx;
  height: 14rpx;
  border: 3rpx solid #8AA3B8;
  border-top: none;
  border-radius: 0 0 20rpx 20rpx;
  background: #fff;
}

.tab-label {
  font-size: 20rpx;
  color: #8AA3B8;
}

.tab-item.active .tab-icon {
  border-color: #3E9BF0;
}

.tab-item.active .tab-icon::before,
.tab-item.active .tab-icon::after {
  border-color: #3E9BF0;
}

.tab-item.active .tab-label {
  color: #3E9BF0;
  font-weight: 600;
}

.center-btn {
  flex: 0 0 140rpx;
  position: relative;
  top: -30rpx;
}

.center-circle {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #3E9BF0 0%, #63B5F6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 28rpx rgba(62, 155, 240, 0.4);
  border: 6rpx solid #fff;
  transition: transform 0.2s;
  position: relative;
}

.center-btn:active .center-circle {
  transform: scale(0.92);
}

.center-plus-h {
  width: 36rpx;
  height: 6rpx;
  background: #fff;
  border-radius: 3rpx;
  position: absolute;
}

.center-plus-v {
  width: 6rpx;
  height: 36rpx;
  background: #fff;
  border-radius: 3rpx;
  position: absolute;
}
</style>
