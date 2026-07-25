<template>
  <view class="page">
    <view class="chat-header">
      <view class="chat-title">{{ conversationTitle }}</view>
    </view>

    <scroll-view class="chat-messages" scroll-y :scroll-into-view="scrollToId">
      <view v-for="msg in messages" :key="msg.id" :id="'msg-' + msg.id" class="msg-row" :class="msg.isMine ? 'mine' : 'other'">
        <view class="msg-avatar">{{ msg.isMine ? '👤' : '🤝' }}</view>
        <view class="msg-content">
          <view class="msg-bubble">{{ msg.content }}</view>
          <view class="msg-time">{{ msg.time }}</view>
        </view>
      </view>
    </scroll-view>

    <view class="chat-input">
      <input v-model="inputText" class="input-field" placeholder="输入消息..." confirm-type="send" @confirm="sendMessage" />
      <view class="send-btn" :class="{ disabled: !inputText.trim() }" @click="sendMessage">发送</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const conversationTitle = ref('对话');
const messages = ref([]);
const inputText = ref('');
const scrollToId = ref('');

function sendMessage() {
  if (!inputText.value.trim()) return;
  uni.showToast({ title: '聊天功能开发中', icon: 'none' });
  inputText.value = '';
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f6f7f9;
}

.chat-header {
  padding: 24rpx 32rpx;
  background: #fff;
  border-bottom: 1rpx solid #e8eceb;
  text-align: center;
}

.chat-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1B3A57;
}

.chat-messages {
  flex: 1;
  padding: 24rpx;
}

.msg-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.msg-row.mine {
  flex-direction: row-reverse;
}

.msg-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #EAF4FD;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  flex-shrink: 0;
}

.msg-content {
  max-width: 70%;
}

.msg-bubble {
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  line-height: 1.5;
}

.msg-row.mine .msg-bubble {
  background: #3E9BF0;
  color: #fff;
  border-bottom-right-radius: 4rpx;
}

.msg-row.other .msg-bubble {
  background: #fff;
  color: #333;
  border-bottom-left-radius: 4rpx;
}

.msg-time {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

.msg-row.mine .msg-time {
  text-align: right;
}

.chat-input {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  background: #fff;
  border-top: 1rpx solid #e8eceb;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.input-field {
  flex: 1;
  height: 72rpx;
  background: #f6f7f9;
  border-radius: 36rpx;
  padding: 0 28rpx;
  font-size: 28rpx;
}

.send-btn {
  background: #3E9BF0;
  color: #fff;
  font-size: 28rpx;
  padding: 16rpx 32rpx;
  border-radius: 36rpx;
  font-weight: 600;
}

.send-btn.disabled {
  background: #ccc;
}
</style>
