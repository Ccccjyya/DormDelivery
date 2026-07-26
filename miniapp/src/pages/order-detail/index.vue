<template>
  <view class="page" v-if="order">
    <view class="header-card">
      <view class="hc-type-row">
        <text class="type-tag" :class="'tag-' + order.orderType">{{ typeLabel[order.orderType] || '外卖' }}</text>
        <text class="hc-status" :class="'s-' + order.status">{{ statusLabel(order) }}</text>
      </view>
      <text class="hc-title">{{ order.orderType === 'grocery' ? order.itemName : (order.orderDetail || order.itemName) }}</text>

      <view class="timer-block" v-if="timerText">
        <text class="timer-num" :class="{ overdue: timerOverdue }">{{ timerText }}</text>
        <text class="timer-sub">{{ timerSubtitle }}</text>
      </view>

      <view class="route-block">
        <view class="route-dot start"></view>
        <text class="route-label">{{ routeFrom }}</text>
        <view class="route-line"></view>
        <view class="route-dot end"></view>
        <text class="route-label">{{ routeTo }}</text>
      </view>
    </view>

    <view class="info-grid">
      <view class="info-item">
        <text class="ii-label">贡献值</text>
        <text class="ii-val orange">{{ order.rewardAmount || 0 }}</text>
      </view>
      <view class="info-item">
        <text class="ii-label">配送时限</text>
        <text class="ii-val">{{ formatLimit(order.deliveryLimitMinutes ?? order.timeLimitMinutes ?? 720) }}</text>
      </view>
      <view class="info-item">
        <text class="ii-label">发布时间</text>
        <text class="ii-val small">{{ formatTime(order.createdAt) }}</text>
      </view>
      <view class="info-item" v-if="order.completedAt">
        <text class="ii-label">送达时间</text>
        <text class="ii-val small">{{ formatTime(order.completedAt) }}</text>
      </view>
      <view class="info-item" v-if="order.deliveryDurationSeconds != null">
        <text class="ii-label">配送用时</text>
        <text class="ii-val">{{ formatDuration(order.deliveryDurationSeconds) }}</text>
      </view>
    </view>

    <view v-if="order.orderType === 'grocery' && order.groceryItems && order.groceryItems.length" class="items-card">
      <view class="items-title">商品清单</view>
      <view v-for="it in order.groceryItems" :key="it.productId" class="item-row">
        <image v-if="it.imageFileId" :src="it.imageFileId" class="item-img" mode="aspectFill" />
        <view v-else class="item-img-placeholder"></view>
        <view class="item-info">
          <text class="item-name">{{ it.name }}</text>
          <text class="item-meta">¥{{ it.price }} × {{ it.qty }}</text>
        </view>
        <text class="item-subtotal">¥{{ (it.price * it.qty).toFixed(2) }}</text>
      </view>
      <view v-if="order.groceryItems.length" class="items-total">
        <text class="it-label">合计</text>
        <text class="it-val">¥{{ groceryTotal }}</text>
      </view>
    </view>

    <view class="detail-card">
      <view class="dc-item" v-if="showPrivate && order.pickupCode">
        <text class="dc-label">取餐码 / 取件码</text>
        <text class="dc-text code-text">{{ order.pickupCode }}</text>
      </view>
      <view class="dc-item" v-if="order.remark">
        <text class="dc-label">备注</text>
        <text class="dc-text">{{ order.remark }}</text>
      </view>
      <view class="dc-item" v-if="order.pickupAddress">
        <text class="dc-label">取件地址</text>
        <text class="dc-text">{{ order.pickupAddress }}</text>
      </view>
      <view class="dc-item">
        <text class="dc-label">发布者</text>
        <text class="dc-text">{{ order.publisherSnapshot?.displayName || '同学' }}</text>
      </view>
      <view class="dc-item">
        <text class="dc-label">送达</text>
        <text class="dc-text">{{ order.publisherSnapshot?.fullRoomLabel }}</text>
      </view>
      <view class="dc-item" v-if="order.receiverSnapshot?.displayName">
        <text class="dc-label">接单人</text>
        <text class="dc-text">{{ order.receiverSnapshot.displayName }}</text>
      </view>
    </view>

    <view v-if="showPrivate && order.imageFileIds && order.imageFileIds.length">
      <view v-if="order.orderType === 'printing'" class="files-card">
        <text class="pg-title">打印文件</text>
        <view v-for="(fileId, idx) in order.imageFileIds" :key="fileId" class="file-row">
          <text class="file-name">📄 {{ printingFileNames[idx] || ('文件' + (idx + 1)) }}</text>
          <button class="dl-btn" @click="downloadFile(fileId)">下载</button>
        </view>
      </view>
      <view v-else class="photo-gallery">
        <text class="pg-title">外卖信息截图</text>
        <view class="pg-grid">
          <image
            v-for="(fileId, idx) in order.imageFileIds"
            :key="fileId"
            :src="fileId"
            class="pg-img"
            mode="aspectFill"
            @click="preview(fileId)"
          />
        </view>
      </view>
    </view>

    <view class="actions">
      <button class="act-btn primary" v-if="canAccept" @click="accept">接单</button>
      <button class="act-btn chat" v-if="showChat" @click="openChat">私聊</button>
      <button class="act-btn primary" v-if="canComplete" @click="complete">完成配送</button>
      <button class="act-btn danger" v-if="canWithdraw" @click="expire">下架订单</button>
      <button class="act-btn warn" v-if="!viewOnly && order.canComplain" @click="complaint">提交投诉</button>
    </view>
  </view>
</template>

<script setup>
import { onLoad, onShow } from '@dcloudio/uni-app';
import { ref, computed, onUnmounted } from 'vue';
import { useUserStore } from '../../stores/user';
import { api } from '../../utils/request';

const store = useUserStore();
const id = ref(null);
const order = ref(null);
const viewOnly = ref(false);
const timerText = ref('');
const timerOverdue = ref(false);
const timerSubtitle = ref('');
let timer = 0;

const typeLabel = { takeout: '外卖', package: '快递', grocery: '帮买', printing: '打印' };

const routeFrom = computed(() => {
  const o = order.value;
  if (!o) return '';
  if (o.orderType === 'grocery') {
    const name = o.itemName || '便利店';
    const addr = o.pickupAddress || '';
    return addr ? name + '(' + addr + ')' : name;
  }
  return o.itemName || (o.pickupMode === 'station' ? '驿站' : '宿舍楼下');
});
const routeTo = computed(() => {
  const o = order.value;
  return o ? (o.destinationLabel || (o.publisherSnapshot && o.publisherSnapshot.fullRoomLabel) || '') : '';
});
const groceryTotal = computed(() => {
  const items = (order.value && order.value.groceryItems) || [];
  return items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0).toFixed(2);
});

function statusLabel(o) {
  if (o.withdrawn) return '已下架';
  return { WAITING: '待接单', DELIVERING: '配送中', COMPLETED: '已完成', EXPIRED: '已过期' }[o.status] || o.status;
}

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

function getCurrentLimit(o) {
  if (o.status === 'DELIVERING') {
    return o.deliveryLimitMinutes ?? o.timeLimitMinutes ?? 720;
  }
  return o.acceptLimitMinutes ?? o.timeLimitMinutes ?? 720;
}

function formatLimit(min) {
  if (!min || min >= 720) return '不限时';
  if (min >= 60) return Math.floor(min / 60) + '小时' + (min % 60 ? min % 60 + '分钟' : '');
  return min + '分钟';
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0秒';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return h + '小时' + m + '分钟' + s + '秒';
  if (m > 0) return m + '分钟' + s + '秒';
  return s + '秒';
}

const canAccept = ref(false);
const canComplete = ref(false);
const canWithdraw = ref(false);
const showChat = ref(false);

const currentUserId = computed(() => {
  const profile = store.profile || uni.getStorageSync('cloudProfile') || {};
  return profile.id || '';
});
const showPrivate = computed(() => {
  const o = order.value;
  return o && (o.status !== 'WAITING' || o.publisherId === currentUserId.value);
});
const printingFileNames = computed(() => {
  const detail = (order.value && order.value.orderDetail) || '';
  if (!detail) return [];
  return detail.split(/[、,，]/).filter(Boolean);
});

async function downloadFile(fileId) {
  uni.showLoading({ title: '下载中...' });
  try {
    const res = await wx.cloud.downloadFile({ fileID: fileId });
    uni.hideLoading();
    wx.openDocument({ filePath: res.tempFilePath, showMenu: true });
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: '下载失败，请重试', icon: 'none' });
  }
}

function updateButtons() {
  const o = order.value;
  const profile = store.profile || uni.getStorageSync('cloudProfile') || {};
  const uid = profile.id;
  if (!o || !uid) return;
  canAccept.value = !viewOnly.value && o.status === 'WAITING' && !o.withdrawn && o.publisherId !== uid;
  canComplete.value = !viewOnly.value && o.status === 'DELIVERING' && o.receiverId === uid;
  canWithdraw.value = !viewOnly.value && o.status === 'WAITING' && !o.withdrawn && o.publisherId === uid;
  showChat.value = !o.withdrawn && ['DELIVERING', 'COMPLETED'].includes(o.status) && (o.publisherId === uid || o.receiverId === uid);
}

function updateTimer() {
  const o = order.value;
  if (!o || o.withdrawn || o.status === 'COMPLETED' || o.status === 'EXPIRED') { timerText.value = ''; return; }
  if (getCurrentLimit(o) >= 720) { timerText.value = '不限时'; return; }
  const dl = o.status === 'WAITING' ? o.expiresAt : o.deliveryDeadline;
  if (!dl) return;
  const r = Math.floor((new Date(dl).getTime() - Date.now()) / 1000);
  if (r <= 0) {
    timerOverdue.value = true;
    if (o.status === 'WAITING') { timerText.value = '已过期'; timerSubtitle.value = ''; }
    else {
      const abs = Math.abs(r);
      const oh = Math.floor(abs / 3600), om = Math.floor((abs % 3600) / 60), os = abs % 60;
      timerText.value = oh > 0 ? oh + ':' + String(om).padStart(2,'0') + ':' + String(os).padStart(2,'0') : om + ':' + String(os).padStart(2,'0');
      timerSubtitle.value = '超时';
    }
  } else {
    const d = Math.floor(r / 86400), h = Math.floor((r % 86400) / 3600), m = Math.floor((r % 3600) / 60), s = r % 60;
    if (d > 0) timerText.value = d + '天 ' + h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    else if (h > 0) timerText.value = h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    else if (m > 0) timerText.value = m + ':' + String(s).padStart(2,'0');
    else timerText.value = s + '秒';
    timerSubtitle.value = o.status === 'WAITING' ? '剩余时间' : '配送剩余';
  }
}

async function load() {
  order.value = await api.orderDetail(id.value);
  const o = order.value;
  if (o) {
    updateTimer();
    updateButtons();
  }
}

onLoad((q) => { id.value = q.id; viewOnly.value = q.viewOnly === '1'; });
onShow(async () => {
  if (!id.value) return;
  await store.fetchMe();
  await load();
  timer = setInterval(updateTimer, 1000);
});
onUnmounted(() => clearInterval(timer));

async function accept() { try { await confirmThen('确认接单后请及时完成配送', () => api.acceptOrder(id.value)); await load(); } catch (e) { await load(); } }
async function complete() { try { await confirmThen('确认物品已送达？', () => api.completeOrder(id.value)); await load(); } catch (e) { await load(); } }
async function expire() { try { await confirmThen('确认下架此订单？', () => api.expireOrder(id.value)); await load(); } catch (e) { await load(); } }
function complaint() { uni.navigateTo({ url: '/pages/complaint-create/index?orderId=' + id.value }); }
function preview(fileId) { wx.previewImage({ current: fileId, urls: order.value.imageFileIds }); }
function openChat() {
  const profile = store.profile || uni.getStorageSync('cloudProfile') || {};
  const myId = profile.id;
  const pub = order.value?.publisherSnapshot || {};
  const recv = order.value?.receiverSnapshot || {};
  const isMine = myId === order.value?.publisherId;
  const peer = isMine ? recv : pub;
  const peerOpenid = isMine ? order.value?.receiverOpenid : order.value?.publisherOpenid;
  uni.navigateTo({ url: '/pages/chat/index?orderId=' + id.value + '&peerOpenid=' + encodeURIComponent(peerOpenid || '') + '&peerName=' + encodeURIComponent(peer.displayName || '') });
}
function confirmThen(content, action) {
  return new Promise((resolve, reject) => uni.showModal({ title: '请确认', content, success: async ({ confirm }) => {
    if (!confirm) return reject(new Error('cancelled'));
    try { await action(); resolve(); } catch (e) { reject(e); }
  }}));
}
</script>

<style scoped>
.page { min-height: 100vh; background: #F3F8FD; padding: 24rpx; box-sizing: border-box; }

/* 头部卡片 */
.header-card { background: linear-gradient(135deg, #3E9BF0, #63B5F6); border-radius: 24rpx; padding: 32rpx; color: #fff; margin-bottom: 24rpx; }
.hc-type-row { display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx; }
.type-tag { font-size: 22rpx; padding: 4rpx 14rpx; border: 1rpx solid rgba(255,255,255,0.5); border-radius: 6rpx; background: rgba(255,255,255,0.15); }
.hc-status { font-size: 24rpx; opacity: 0.9; }
.s-WAITING { color: #BBDEFB; }
.s-DELIVERING { color: #FFE082; }
.s-COMPLETED { color: #A5D6A7; }
.hc-title { font-size: 36rpx; font-weight: 700; line-height: 1.4; margin-bottom: 24rpx; }

/* 定时器 */
.timer-block { text-align: center; padding: 20rpx 0; margin-bottom: 16rpx; }
.timer-num { font-size: 64rpx; font-weight: 900; letter-spacing: -2rpx; }
.timer-num.overdue { color: #FFCDD2; }
.timer-sub { font-size: 22rpx; opacity: 0.8; display: block; margin-top: 4rpx; }

/* 路线 */
.route-block { display: flex; align-items: center; gap: 16rpx; background: rgba(255,255,255,0.15); border-radius: 14rpx; padding: 20rpx; }
.route-dot { width: 14rpx; height: 14rpx; border-radius: 50%; flex-shrink: 0; }
.route-dot.start { background: #A5D6A7; }
.route-dot.end { background: #FFE082; }
.route-line { flex: 1; height: 2rpx; background: rgba(255,255,255,0.3); }
.route-label { font-size: 26rpx; opacity: 0.9; max-width: 200rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 信息网格 */
.info-grid { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.items-card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx; border: 1rpx solid #E3F1FD; }
.items-title { font-size: 28rpx; font-weight: 600; color: #2A4257; margin-bottom: 16rpx; }
.item-row { display: flex; align-items: center; gap: 16rpx; padding: 12rpx 0; border-bottom: 1rpx solid #F0F4F8; }
.item-row:last-of-type { border-bottom: none; }
.item-img { width: 100rpx; height: 100rpx; border-radius: 10rpx; background: #F5F6F8; flex-shrink: 0; }
.item-img-placeholder { width: 100rpx; height: 100rpx; border-radius: 10rpx; background: #F5F6F8; flex-shrink: 0; }
.item-info { flex: 1; min-width: 0; }
.item-name { font-size: 26rpx; color: #2A4257; display: block; }
.item-meta { font-size: 22rpx; color: #8AA3B8; margin-top: 4rpx; display: block; }
.item-subtotal { font-size: 26rpx; font-weight: 600; color: #FF7043; flex-shrink: 0; }
.items-total { display: flex; justify-content: space-between; padding-top: 16rpx; margin-top: 8rpx; border-top: 2rpx solid #E3F1FD; }
.it-label { font-size: 26rpx; color: #8AA3B8; font-weight: 600; }
.it-val { font-size: 32rpx; color: #FF7043; font-weight: 700; }
.info-item { flex: 1; background: #fff; border-radius: 16rpx; padding: 20rpx; text-align: center; border: 1rpx solid #E3F1FD; }
.ii-label { font-size: 22rpx; color: #8AA3B8; display: block; margin-bottom: 8rpx; }
.ii-val { font-size: 28rpx; font-weight: 700; color: #2A4257; white-space: nowrap; }
.ii-val.orange { color: #FF7043; }
.ii-val.small { font-size: 22rpx; white-space: nowrap; }

/* 详情卡 */
.detail-card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx; border: 1rpx solid #E3F1FD; }
.dc-item { padding: 16rpx 0; border-bottom: 1rpx solid #F3F8FD; }
.dc-item:last-child { border-bottom: none; }
.dc-label { font-size: 24rpx; color: #8AA3B8; display: block; margin-bottom: 6rpx; }
.dc-text { font-size: 28rpx; color: #2A4257; }
.code-text { font-size: 36rpx; font-weight: 700; color: #FF7043; letter-spacing: 4rpx; }

/* 图片 */
.photo-gallery { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx; border: 1rpx solid #E3F1FD; }
.files-card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx; border: 1rpx solid #E3F1FD; }
.file-row { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 0; border-bottom: 1rpx solid #F0F4F8; }
.file-row:last-child { border-bottom: none; }
.file-name { font-size: 26rpx; color: #2A4257; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dl-btn { background: #3E9BF0; color: #fff; padding: 8rpx 20rpx; border-radius: 10rpx; font-size: 24rpx; flex-shrink: 0; margin-left: 12rpx; line-height: 1.4; }
.pg-title { font-size: 28rpx; font-weight: 600; color: #2A4257; margin-bottom: 16rpx; display: block; }
.pg-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.pg-img { width: 200rpx; height: 200rpx; border-radius: 14rpx; background: #f0f0f0; }

/* 操作按钮 */
.actions { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 40rpx; padding: 0 24rpx; }
.act-btn { width: 100%; height: 88rpx; line-height: 88rpx; border-radius: 16rpx; font-size: 30rpx; font-weight: 600; text-align: center; border: none; display: block; }
.act-btn::after { border: none; }
.act-btn.chat { background: #fff; color: #3E9BF0; border: 1rpx solid #3E9BF0; }
.act-btn.primary { background: #3E9BF0; color: #fff; }
.act-btn.danger { background: #E57373; color: #fff; }
.act-btn.warn { background: #FF7043; color: #fff; }
.act-btn[disabled] { opacity: 0.5; }
</style>
