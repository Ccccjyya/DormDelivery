<template>
  <view class="page" v-if="order">
    <view class="header-card">
      <view class="hc-type-row">
        <text class="type-tag" :class="'tag-' + order.orderType">{{ typeLabel[order.orderType] || '外卖' }}</text>
        <text class="hc-status" :class="'s-' + order.status">{{ statusLabel(order) }}</text>
      </view>
      <text class="hc-title">{{ order.orderDetail || order.itemName }}</text>

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
        <text class="ii-label">{{ order.status === 'WAITING' ? '接单时限' : '配送时限' }}</text>
        <text class="ii-val">{{ formatLimit(getCurrentLimit(order)) }}</text>
      </view>
      <view class="info-item">
        <text class="ii-label">发布时间</text>
        <text class="ii-val small">{{ formatTime(order.createdAt) }}</text>
      </view>
    </view>

    <view class="detail-card">
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

    <view class="photo-gallery" v-if="order.imageFileIds && order.imageFileIds.length">
      <text class="pg-title">订单图片</text>
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

    <view class="actions">
      <button class="act-btn primary" v-if="canAccept" @click="accept">接单</button>
      <button class="act-btn chat" v-if="showChat" @click="openChat">💬 私聊</button>
      <button class="act-btn primary" v-if="canComplete" @click="complete">完成配送</button>
      <button class="act-btn danger" v-if="canWithdraw" @click="expire">下架订单</button>
      <button class="act-btn warn" v-if="!viewOnly && order.canComplain" @click="complaint">提交投诉</button>
    </view>
  </view>
</template>

<script setup>
import { onLoad, onShow } from '@dcloudio/uni-app';
import { ref, onUnmounted } from 'vue';
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

const routeFrom = ref('');
const routeTo = ref('');

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

const canAccept = ref(false);
const canComplete = ref(false);
const canWithdraw = ref(false);
const showChat = ref(false);

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
    const pub = o.publisherSnapshot || {};
    const isStation = o.pickupMode === 'station';
    routeFrom.value = o.itemName || (isStation ? '驿站' : '宿舍楼下');
    routeTo.value = o.destinationLabel || pub.fullRoomLabel || '';
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
function openChat() { uni.navigateTo({ url: '/pages/chat/index?orderId=' + id.value }); }
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
.info-item { flex: 1; background: #fff; border-radius: 16rpx; padding: 20rpx; text-align: center; border: 1rpx solid #E3F1FD; }
.ii-label { font-size: 22rpx; color: #8AA3B8; display: block; margin-bottom: 8rpx; }
.ii-val { font-size: 32rpx; font-weight: 700; color: #2A4257; }
.ii-val.orange { color: #FF7043; }
.ii-val.small { font-size: 24rpx; }

/* 详情卡 */
.detail-card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx; border: 1rpx solid #E3F1FD; }
.dc-item { padding: 16rpx 0; border-bottom: 1rpx solid #F3F8FD; }
.dc-item:last-child { border-bottom: none; }
.dc-label { font-size: 24rpx; color: #8AA3B8; display: block; margin-bottom: 6rpx; }
.dc-text { font-size: 28rpx; color: #2A4257; }

/* 图片 */
.photo-gallery { margin-bottom: 24rpx; }
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
