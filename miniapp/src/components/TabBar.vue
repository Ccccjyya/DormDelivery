<template>
  <view class="tabbar">
    <view class="tabbar-bg"></view>
    <view class="tabbar-items">
      <view
        v-for="item in leftItems"
        :key="item.key"
        class="tab-item"
        :class="{ active: selected === item.key }"
        @click="switchTab(item.key)"
      >
        <view class="tab-icon-wrap" :class="item.iconClass">
          <view class="ti-inner" :class="item.iconClass + '-inner'"></view>
        </view>
        <view class="tab-label">{{ item.label }}</view>
      </view>

      <view class="tab-item center-btn" @click="openPublish">
        <view class="center-circle">
          <view class="center-plus-h"></view>
          <view class="center-plus-v"></view>
        </view>
      </view>

      <view
        v-for="item in rightItems"
        :key="item.key"
        class="tab-item"
        :class="{ active: selected === item.key }"
        @click="switchTab(item.key)"
      >
        <view class="tab-icon-wrap" :class="item.iconClass">
          <view class="ti-inner" :class="item.iconClass + '-inner'"></view>
          <view v-if="item.key === 'messages' && unreadCount > 0" class="badge" :class="{ 'badge-dot': unreadCount > 99 }">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </view>
        </view>
        <view class="tab-label">{{ item.label }}</view>
      </view>
    </view>

    <TaskTypeSheet v-if="showSheet" @close="showSheet = false" @select="handleSelect" />
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import TaskTypeSheet from './TaskTypeSheet.vue';
import { api } from '../utils/request';

const props = defineProps({
  selected: { type: String, default: 'home' }
});

const emit = defineEmits(['changeTab', 'publish']);

const showSheet = ref(false);
const unreadCount = ref(0);
let pollTimer = 0;

async function refreshUnread() {
  try {
    const res = await api.chatConversations();
    const total = (res?.items || []).reduce((s, c) => s + (c.unread || 0), 0);
    unreadCount.value = total;
  } catch (e) {}
}

onShow(() => { refreshUnread(); });
onMounted(() => {
  refreshUnread();
  pollTimer = setInterval(refreshUnread, 5000);
});
onUnmounted(() => clearInterval(pollTimer));

const leftItems = [
  { key: 'home', iconClass: 'ti-home', label: '首页', path: '/pages/tabbar-home/index' },
  { key: 'orders', iconClass: 'ti-orders', label: '订单', path: '/pages/tabbar-orders/index' }
];

const rightItems = [
  { key: 'messages', iconClass: 'ti-messages', label: '消息', path: '/pages/tabbar-messages/index' },
  { key: 'profile', iconClass: 'ti-profile', label: '我的', path: '/pages/tabbar-profile/index' }
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

function openPublish() { showSheet.value = true; }

function handleSelect(type) {
  showSheet.value = false;
  const routes = {
    takeout: '/pages/task-publish-takeout/index',
    package: '/pages/task-publish-package/index',
    grocery: '/pages/task-publish-store/index',
    printing: '/pages/task-publish-printing/index'
  };
  const url = routes[type];
  if (url) uni.navigateTo({ url });
  emit('publish', type);
}
</script>

<style scoped>
.tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 999; }

.tabbar-bg {
  position: absolute; left: 0; right: 0; top: 0; bottom: 0;
  background: #fff;
  box-shadow: 0 -4rpx 24rpx rgba(62, 155, 240, 0.08);
}

.tabbar-items {
  position: relative;
  display: flex; align-items: flex-end; justify-content: space-around;
  height: 140rpx;
  padding-bottom: env(safe-area-inset-bottom);
  background: #fff;
}

.tab-item {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 8rpx; padding: 12rpx 0; height: 100%;
}

.tab-icon-wrap {
  width: 52rpx; height: 52rpx; position: relative;
  display: flex; align-items: center; justify-content: center;
}

.badge {
  position: absolute; top: -4rpx; right: -10rpx;
  min-width: 32rpx; height: 32rpx;
  background: #FF3B30; color: #fff;
  border-radius: 16rpx;
  font-size: 20rpx; line-height: 32rpx;
  text-align: center; font-weight: 600;
  padding: 0 8rpx;
  border: 2rpx solid #fff;
  box-sizing: border-box;
}
.badge-dot { width: 16rpx; min-width: 16rpx; padding: 0; font-size: 0; }

/* Home icon - house shape */
.ti-home-inner {
  width: 36rpx; height: 22rpx;
  border: 3rpx solid currentColor; border-top: none;
  border-radius: 0 0 4rpx 4rpx;
  margin-top: 6rpx; position: relative;
}
.ti-home-inner::before {
  content: '';
  position: absolute; top: -14rpx; left: 50%;
  transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 22rpx solid transparent;
  border-right: 22rpx solid transparent;
  border-bottom: 16rpx solid currentColor;
}
.ti-home-inner::after {
  content: '';
  position: absolute; bottom: -4rpx; left: 50%;
  transform: translateX(-50%);
  width: 14rpx; height: 16rpx;
  border: 3rpx solid currentColor;
  border-top: none; border-radius: 0 0 4rpx 4rpx;
  background: #fff;
}

/* Orders icon - document with lines */
.ti-orders-inner {
  width: 36rpx; height: 40rpx;
  border: 3rpx solid currentColor; border-radius: 4rpx;
  position: relative;
}
.ti-orders-inner::before {
  content: '';
  position: absolute; top: 12rpx; left: 8rpx; right: 8rpx;
  height: 3rpx; background: currentColor;
  box-shadow: 0 8rpx 0 currentColor, 0 16rpx 0 currentColor;
}

/* Messages icon - chat bubble */
.ti-messages-inner {
  width: 36rpx; height: 30rpx;
  border: 3rpx solid currentColor; border-radius: 8rpx;
  position: relative;
}
.ti-messages-inner::before {
  content: '';
  position: absolute; bottom: -8rpx; left: 6rpx;
  width: 12rpx; height: 10rpx;
  border: 3rpx solid currentColor;
  border-top: none; border-left: none;
  border-radius: 0 0 6rpx 0;
  transform: rotate(45deg);
  background: #fff;
}

/* Profile icon - person shape */
.ti-profile-inner {
  width: 36rpx; height: 24rpx;
  border: 3rpx solid currentColor; border-top: none;
  border-radius: 0 0 20rpx 20rpx;
  position: relative; margin-top: 10rpx;
}
.ti-profile-inner::before {
  content: '';
  position: absolute; top: -16rpx; left: 50%;
  transform: translateX(-50%);
  width: 20rpx; height: 20rpx;
  border: 3rpx solid currentColor;
  border-radius: 50%;
  background: #fff;
}

.tab-label { font-size: 20rpx; color: #8AA3B8; }

/* Inactive - gray */
.tab-icon-wrap { color: #8AA3B8; }
.tab-item.active .tab-icon-wrap { color: #3E9BF0; }
.tab-item.active .tab-label { color: #3E9BF0; font-weight: 600; }

/* Background behind person head */
.tab-item.active .ti-profile-inner::before { background: #fff; }
.tab-item .ti-profile-inner::before { background: #fff; }
.tab-item.active .ti-home-inner::after { background: #fff; }
.tab-item .ti-home-inner::after { background: #fff; }
.tab-item.active .ti-messages-inner::before { background: #fff; }
.tab-item .ti-messages-inner::before { background: #fff; }

.center-btn { flex: 0 0 140rpx; position: relative; top: -30rpx; }

.center-circle {
  width: 100rpx; height: 100rpx; border-radius: 50%;
  background: linear-gradient(135deg, #3E9BF0 0%, #63B5F6 100%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 28rpx rgba(62, 155, 240, 0.4);
  border: 6rpx solid #fff;
  transition: transform 0.2s; position: relative;
}

.center-btn:active .center-circle { transform: scale(0.92); }

.center-plus-h { width: 36rpx; height: 6rpx; background: #fff; border-radius: 3rpx; position: absolute; }
.center-plus-v { width: 6rpx; height: 36rpx; background: #fff; border-radius: 3rpx; position: absolute; }
</style>
