<template>
  <view class="page">
    <view class="msg-list">
      <view v-for="msg in messages" :key="msg._divider ? msg.timeText : msg.id">
        <view v-if="msg._divider" class="time-divider">
          <text class="td-text">{{ msg.timeText }}</text>
        </view>
        <view v-else class="msg-row" :class="msg.isMine ? 'row-mine' : 'row-theirs'">
        <view v-if="!msg.isMine" class="avatar av-theirs">{{ peerInitial }}</view>
        <view v-else class="avatar-placeholder"></view>

        <view v-if="msg.isMine" class="msg-body body-mine">
          <text class="read-status">{{ msg.isRead ? '已读' : '未读' }}</text>
          <view class="bubble b-mine">
            <text v-if="msg.type === 'text'" class="b-text">{{ msg.content }}</text>
            <image v-else :src="msg.fileId" class="b-img" mode="aspectFill" @click="previewImage(msg.fileId)" />
          </view>
        </view>
        <view v-else class="msg-body body-theirs">
          <view class="bubble b-theirs">
            <text v-if="msg.type === 'text'" class="b-text">{{ msg.content }}</text>
            <image v-else :src="msg.fileId" class="b-img" mode="aspectFill" @click="previewImage(msg.fileId)" />
          </view>
        </view>

        <view v-if="msg.isMine" class="avatar av-mine">我</view>
        <view v-else class="avatar-placeholder"></view>
      </view>
    </view>
    </view>

    <view class="input-bar">
      <view class="ib-add" @click="chooseImage">+</view>
      <input class="ib-input" v-model="text" placeholder="戳这里输入消息..." confirm-type="send" @confirm="sendText" />
      <view class="ib-send" :class="{ disabled: !text.trim() }" @click="sendText">发送</view>
    </view>
  </view>
</template>

<script setup>
import { onLoad } from '@dcloudio/uni-app';
import { ref, onUnmounted } from 'vue';
import { api } from '@/utils/request';

const orderId = ref('');
const peerName = ref('同学');
const peerInitial = ref('?');
const messages = ref([]);
const text = ref('');
let pollTimer = 0;

onLoad(async (q) => {
  orderId.value = q.orderId || '';
  try {
    const order = await api.orderDetail(orderId.value);
    if (order) {
      const profile = uni.getStorageSync('cloudProfile') || {};
      const myId = profile.id;
      const pub = order.publisherSnapshot || {};
      const recv = order.receiverSnapshot || {};
      const peer = myId === order.publisherId ? recv : pub;
      if (peer.displayName) {
        peerName.value = peer.displayName;
        peerInitial.value = peer.displayName.charAt(0);
      }
      uni.setNavigationBarTitle({ title: peerName.value });
    }
  } catch (e) {}
  poll();
  pollTimer = setInterval(poll, 2000);
});
onUnmounted(() => clearInterval(pollTimer));

async function poll() {
  try {
    const res = await api.chatMessages({ orderId: orderId.value });
    if (res?.items) messages.value = addTimeDividers(res.items);
  } catch (e) {}
}

function addTimeDividers(items) {
  if (!items || items.length === 0) return [];
  const out = [];
  const GAP_MIN = 2;
  for (let i = 0; i < items.length; i++) {
    const prev = i > 0 ? new Date(items[i - 1].createdAt).getTime() : 0;
    const cur = new Date(items[i].createdAt).getTime();
    if (i === 0 || (cur - prev) > GAP_MIN * 60000) {
      out.push({ _divider: true, timeText: formatDividerTime(new Date(items[i].createdAt)) });
    }
    out.push(items[i]);
  }
  return out;
}

function formatDividerTime(d) {
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  if (isToday) return h + ':' + m;
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + h + ':' + m;
}

async function sendText() {
  const t = text.value.trim();
  if (!t) return;
  text.value = '';
  try {
    await api.sendChat({ orderId: orderId.value, content: t, type: 'text' });
    await poll();
  } catch (e) {}
}

async function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempPath = res.tempFilePaths[0];
      uni.showLoading({ title: '上传中' });
      try {
        const uploadRes = await wx.cloud.uploadFile({ cloudPath: 'chat/' + Date.now() + '.jpg', filePath: tempPath });
        await api.sendChat({ orderId: orderId.value, fileId: uploadRes.fileID, type: 'image' });
        await poll();
      } catch (e) {
        uni.showToast({ title: '发送失败', icon: 'none' });
      }
      uni.hideLoading();
    }
  });
}

function previewImage(url) {
  const urls = messages.value.filter(m => m.type === 'image').map(m => m.fileId);
  wx.previewImage({ current: url, urls });
}
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #F3F8FD; padding-top: 30rpx; padding-bottom: 120rpx; box-sizing: border-box; }

.msg-list { width: 100%; }

.time-divider { display: flex; justify-content: center; margin: 12rpx 0; }
.td-text { font-size: 22rpx; color: #B0B0B0; background: rgba(0,0,0,0.06); padding: 6rpx 18rpx; border-radius: 8rpx; }

.msg-row { display: flex; align-items: flex-start; width: 100%; box-sizing: border-box; padding: 0 10rpx; margin-bottom: 28rpx; }
.row-mine { justify-content: flex-end; }
.row-theirs { justify-content: flex-start; }

.avatar { width: 72rpx; height: 72rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28rpx; color: #fff; font-weight: 500; flex-shrink: 0; margin: 0 10rpx; }
.av-theirs { background: linear-gradient(135deg, #FF7043, #FF8A65); }
.av-mine { background: linear-gradient(135deg, #3E9BF0, #63B5F6); }
.avatar-placeholder { width: 72rpx; height: 1rpx; flex-shrink: 0; margin: 0 10rpx; }

.msg-body { max-width: 65vw; min-width: 0; box-sizing: border-box; }
.body-mine { text-align: right; }
.bubble { padding: 18rpx 24rpx; border-radius: 16rpx; display: inline-block; max-width: 100%; box-sizing: border-box; text-align: left; }
.b-mine { background: #3E9BF0; }
.b-mine .b-text { color: #fff; }
.b-theirs { background: #fff; box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.04); }
.b-theirs .b-text { color: #333; }
.b-text { font-size: 30rpx; line-height: 1.5; word-break: break-all; display: block; }
.b-img { width: 240rpx; height: 240rpx; border-radius: 10rpx; display: block; }

.read-status { font-size: 20rpx; color: #999; margin-right: 8rpx; display: inline-block; vertical-align: bottom; margin-bottom: 4rpx; }

.input-bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 14rpx; padding: 16rpx 20rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); background: #fff; border-top: 1rpx solid #E3F1FD; z-index: 10; }
.ib-add { width: 60rpx; height: 60rpx; border-radius: 50%; background: #E3F1FD; color: #3E9BF0; font-size: 36rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ib-input { flex: 1; height: 72rpx; background: #F3F8FD; border-radius: 36rpx; padding: 0 24rpx; font-size: 28rpx; }
.ib-send { padding: 14rpx 24rpx; background: #3E9BF0; color: #fff; border-radius: 36rpx; font-size: 28rpx; flex-shrink: 0; }
.ib-send.disabled { opacity: 0.4; }
</style>