<template>
  <view class="page">
    <view class="header-wrapper">
      <StatusBar />
      <view class="page-header">
        <view class="header-title">消息</view>
      </view>
    </view>

    <view class="page-body">
      <view v-if="loading" class="loading">加载中...</view>
      <view v-else-if="conversations.length === 0" class="empty">
        <view class="empty-icon"></view>
        <text class="empty-text">暂无消息</text>
        <text class="empty-hint">发布或接单后可与对方私信沟通</text>
      </view>
      <view v-for="conv in conversations" :key="conv.orderId" class="conv-item" @click="goChat(conv.orderId)">
        <view class="conv-avatar">
          <text class="avatar-initial">{{ (conv.peerName || '?').charAt(0) }}</text>
        </view>
        <view class="conv-content">
          <view class="conv-row1">
            <text class="conv-name">{{ conv.peerName }}</text>
            <text class="conv-time">{{ formatTime(conv.latestTime) }}</text>
          </view>
          <view class="conv-row2">
            <text class="conv-preview">
              <text v-if="conv.isMineLatest" class="me-tag">[我]</text>
              {{ conv.latestMessage }}
            </text>
            <view v-if="conv.unread > 0" class="conv-unread">{{ conv.unread }}</view>
          </view>
        </view>
      </view>

      <view class="safe-bottom"></view>
    </view>

    <TabBar selected="messages" />
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
import TabBar from '@/components/TabBar.vue';
import StatusBar from '@/components/StatusBar.vue';
import { api } from '@/utils/request';

const conversations = ref([]);
const loading = ref(false);

onLoad(() => load());
onShow(() => load());
onPullDownRefresh(function(){ runPullDownRefresh(async function(){ uni.showLoading({ title: '刷新中' }); await load(); uni.hideLoading(); }); });

async function load() {
  loading.value = true;
  try {
    const res = await api.chatConversations();
    conversations.value = res?.items || [];
  } catch (e) { conversations.value = []; }
  loading.value = false;
}

function goChat(orderId) {
  uni.navigateTo({ url: '/pages/chat/index?orderId=' + orderId });
}

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t), now = new Date();
  if (d.toDateString() === now.toDateString()) return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  const diff = Math.floor((now-d)/86400000);
  if (diff<7) return ['日','一','二','三','四','五','六'][d.getDay()]+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  return (d.getMonth()+1)+'/'+d.getDate();
}
</script>

<style scoped>
.page { height: 100vh; background: #fff; display: flex; flex-direction: column; }
.header-wrapper { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: linear-gradient(160deg, #3E9BF0 0%, #63B5F6 100%); }
.page-header { padding: 16rpx 32rpx 28rpx; }
.header-title { font-size: 40rpx; font-weight: 700; color: #fff; }
.page-body { width: 100%; padding-top: 180rpx; padding-bottom: 160rpx; padding-left: 0; padding-right: 0; background: #fff; flex: 1; box-sizing: border-box; }

.loading { text-align: center; padding: 80rpx 0; color: #8AA3B8; font-size: 26rpx; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; }
.empty-icon { width: 120rpx; height: 120rpx; border: 4rpx solid #C2E2FC; border-radius: 50%; margin-bottom: 24rpx; }
.empty-text { font-size: 30rpx; color: #2A4257; font-weight: 500; }
.empty-hint { font-size: 24rpx; color: #8AA3B8; margin-top: 8rpx; }

.conv-item { display: flex; align-items: center; gap: 20rpx; padding: 24rpx 32rpx; border-bottom: 1rpx solid #EFEFEF; }
.conv-item:active { background: #F3F8FD; }
.conv-avatar { width: 90rpx; height: 90rpx; border-radius: 50%; background: linear-gradient(135deg, #3E9BF0, #63B5F6); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.avatar-initial { font-size: 36rpx; color: #fff; font-weight: 600; }
.conv-content { flex: 1; min-width: 0; }
.conv-row1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
.conv-name { font-size: 30rpx; font-weight: 600; color: #2A4257; }
.conv-time { font-size: 22rpx; color: #B5C2D0; }
.conv-row2 { display: flex; justify-content: space-between; align-items: center; }
.conv-preview { font-size: 26rpx; color: #8AA3B8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.me-tag { color: #B5C2D0; margin-right: 4rpx; }
.conv-unread { background: #FF3B30; color: #fff; font-size: 22rpx; min-width: 36rpx; height: 36rpx; padding: 0 10rpx; border-radius: 18rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: 12rpx; }
.safe-bottom { height: 180rpx; }
</style>