<template>
  <view class="page">
    <scroll-view scroll-y class="msg-list" :scroll-into-view="lastMsgId" :scroll-with-animation="true" :enhanced="true" :show-scrollbar="false" lower-threshold="50">
      <view v-for="msg in messages" :key="msg._divider ? msg.timeText : (msg.id || msg._id)">
        <view v-if="msg._divider" class="time-divider">
          <text class="td-text">{{ msg.timeText }}</text>
        </view>
        <view v-else :id="'m-' + (msg.id || msg._id)">
          <view v-if="!msg.isMine" class="msg-row theirs">
            <view class="avatar av-theirs">{{ peerInitial }}</view>
            <view class="bubble b-theirs">
              <text v-if="msg.type === 'text'" class="b-text">{{ msg.content }}</text>
              <image v-else :src="msg.fileId" class="b-img" mode="aspectFill" @click="previewImage(msg.fileId)" />
            </view>
          </view>
          <view v-else class="msg-row mine">
            <view class="mine-wrap">
              <view class="bubble b-mine">
                <text v-if="msg.type === 'text'" class="b-text">{{ msg.content }}</text>
                <image v-else :src="msg.fileId" class="b-img" mode="aspectFill" @click="previewImage(msg.fileId)" />
              </view>
              <text class="read-status">{{ msg.isRead ? '已读' : '未读' }}</text>
            </view>
            <view class="avatar av-mine">我</view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="input-bar" :style="inputBarStyle">
      <view class="ib-add" @click="chooseImage">+</view>
      <input class="ib-input" v-model="text" placeholder="戳这里输入消息..." confirm-type="send" @confirm="sendText" :adjust-position="false" />
      <view class="ib-send" :class="{ disabled: !text.trim() }" @click="sendText">发送</view>
    </view>
  </view>
</template>

<script setup>
import { onLoad } from '@dcloudio/uni-app';
import { ref, computed, onUnmounted } from 'vue';
import { api } from '@/utils/request';

const orderId = ref('');
const peerOpenid = ref('');
const peerName = ref('同学');
const peerInitial = ref('?');
const messages = ref([]);
const text = ref('');
const keyboardHeight = ref(0);
const lastMsgId = ref('');
let pollTimer = 0;

onLoad(async (q) => {
  orderId.value = q.orderId || '';
  peerOpenid.value = q.peerOpenid ? decodeURIComponent(q.peerOpenid) : '';
  if (q.peerName) {
    peerName.value = decodeURIComponent(q.peerName);
    peerInitial.value = peerName.value.charAt(0);
  }
  if (!peerName.value && orderId.value) {
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
        if (!peerOpenid.value) peerOpenid.value = myId === order.publisherId ? order.receiverOpenid : order.publisherOpenid;
      }
    } catch (e) {}
  }
  uni.setNavigationBarTitle({ title: peerName.value });
  poll();
  pollTimer = setInterval(poll, 2000);
});

uni.onKeyboardHeightChange(res => {
  keyboardHeight.value = (res && res.height) || 0;
});
onUnmounted(() => clearInterval(pollTimer));

const inputBarStyle = computed(() => {
  return 'bottom: ' + keyboardHeight.value + 'px;';
});

async function poll() {
  try {
    const params = peerOpenid.value ? { peerOpenid: peerOpenid.value } : { orderId: orderId.value };
    const res = await api.chatMessages(params);
    if (res?.items) {
      messages.value = addTimeDividers(res.items);
      const last = res.items[res.items.length - 1];
      if (last) lastMsgId.value = 'm-' + (last.id || last._id);
    }
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
  if (!orderId.value) return uni.showToast({ title: '请从订单页进入聊天', icon: 'none' });
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
.page { width: 100vw; height: 100vh; background: #EDEDED; display: flex; flex-direction: column; overflow: hidden; }

.msg-list { flex: 1; width: 100%; padding: 20rpx 0 140rpx; box-sizing: border-box; min-height: 0; }

.time-divider { display: flex; justify-content: center; margin: 20rpx 0; }
.td-text { font-size: 22rpx; color: #B0B0B0; background: #DCDCDC; padding: 6rpx 16rpx; border-radius: 6rpx; }

.msg-row { display: flex; align-items: flex-start; padding: 0 20rpx; margin-bottom: 32rpx; box-sizing: border-box; }
.msg-row.theirs { justify-content: flex-start; }
.msg-row.mine { justify-content: flex-end; }

.bubble { padding: 20rpx 26rpx; border-radius: 8rpx; max-width: 68vw; box-sizing: border-box; position: relative; }
.b-mine { background: #3E9BF0; }
.b-mine .b-text { color: #fff; }
.b-theirs { background: #FFFFFF; }
.b-theirs .b-text { color: #000; }
.b-text { font-size: 30rpx; line-height: 1.5; word-break: break-all; }
.b-img { width: 280rpx; height: 280rpx; border-radius: 8rpx; }

.avatar { width: 72rpx; height: 72rpx; border-radius: 8rpx; font-size: 30rpx; color: #fff; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.msg-row.theirs .avatar { margin-right: 20rpx; }
.msg-row.mine .avatar { margin-left: 20rpx; }
.av-theirs { background: #FF7043; }
.av-mine { background: #3E9BF0; }

.mine-wrap { display: flex; flex-direction: column; align-items: flex-end; }
.read-status { font-size: 20rpx; color: #B0B0B0; margin-top: 6rpx; }

.input-bar { position: fixed; left: 0; right: 0; display: flex; align-items: center; gap: 16rpx; padding: 16rpx 20rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); background: #F7F7F7; border-top: 1rpx solid #D9D9D9; z-index: 10; box-sizing: border-box; transition: bottom 0.15s; }
.ib-add { width: 64rpx; height: 64rpx; border-radius: 8rpx; background: #FFFFFF; color: #666; font-size: 36rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 2rpx solid #D9D9D9; }
.ib-input { flex: 1; height: 72rpx; background: #FFFFFF; border-radius: 8rpx; padding: 0 20rpx; font-size: 28rpx; }
.ib-send { padding: 14rpx 28rpx; background: #3E9BF0; color: #fff; border-radius: 8rpx; font-size: 28rpx; flex-shrink: 0; }
.ib-send.disabled { background: #A3CBF0; }
</style>
