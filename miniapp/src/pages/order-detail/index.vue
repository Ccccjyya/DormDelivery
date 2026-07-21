<template>
  <view class="page" v-if="order">
    <view class="title">{{ order.itemName }}</view>
    <view class="card">
      <view class="row"><text>状态</text><text class="status" :class="{ done: order.status === 'COMPLETED', warning: order.status === 'DELIVERING' }">{{ getOrderStatusLabel(order) }}</text></view>
      <view>订单编号：{{ order.orderNo || '未记录' }}</view>
      <view v-if="order.pickupAddress">取件：{{ order.pickupAddress }}</view>
      <view>送达：{{ order.publisherSnapshot?.fullRoomLabel }}</view>
      <view>发布者：{{ order.publisherSnapshot?.displayName }}</view>
      <view>发布时间：{{ formatDateTime(order.createdAt) }}</view><view>时限：{{ order.timeLimitMinutes }}分钟</view>
      <view v-if="order.remark">备注：{{ order.remark }}</view>
      <image v-for="fileId in order.imageFileIds" :key="fileId" class="order-image" :src="fileId" mode="aspectFill" @click="preview(fileId)" />
      <view v-if="order.acceptedAt">接单时间：{{ formatDateTime(order.acceptedAt) }}</view><view v-if="order.completedAt">完成时间：{{ formatDateTime(order.completedAt) }}</view>
      <view v-if="showRewardInfo" class="reward-area">
        <view v-if="isReceiver && completionMessage" class="completion-message">{{ completionMessage }}</view>
        <view v-if="order.complaintDeadline">投诉截止时间：{{ formatDateTime(order.complaintDeadline) }}</view>
        <view>投诉状态：{{ complaintStatusLabel }}</view>
        <view v-if="isReceiver">贡献值状态：{{ rewardStatusLabel }}</view>
        <view v-if="isReceiver && order.rewardAmount !== null && order.rewardAmount !== undefined">贡献值数值：{{ order.rewardAmount }}</view>
      </view>
      <view v-if="order.overdue">已超时</view>
    </view>
    <button class="btn" v-if="canAccept" :disabled="store.profile?.acceptBlocked" @click="accept">{{ store.profile?.acceptBlocked ? '已被禁止接单' : '接取订单' }}</button>
    <button class="btn" v-if="canComplete" @click="complete">完成配送</button>
    <button class="btn danger" v-if="canWithdraw" @click="expire">下架订单</button>
    <button class="btn complaint-action" v-if="!viewOnly && order.canComplain" @click="complaint">提交投诉</button>
  </view>
</template>

<script setup>
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { useUserStore } from '../../stores/user';
import { api } from '../../utils/request';
import { formatDateTime, getOrderStatusLabel } from '../../utils/orderDisplay';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
const id = ref(null);
const order = ref(null);
const invalidNoticeShown = ref(false);
const viewOnly = ref(false);
const store = useUserStore();
const canWithdraw = computed(() => !viewOnly.value && order.value?.status === 'WAITING' && !order.value.withdrawn && order.value.publisherId === store.profile?.id);
const canAccept = computed(() => !viewOnly.value && order.value?.status === 'WAITING' && !order.value.withdrawn && order.value.publisherId !== store.profile?.id);
const canComplete = computed(() => !viewOnly.value && order.value?.status === 'DELIVERING' && order.value.receiverId === store.profile?.id);
const isReceiver = computed(() => Boolean(order.value?.receiverId) && order.value.receiverId === store.profile?.id);
const complaintStatusLabel = computed(() => ({ PENDING: '待审核', UPHELD: '投诉成立', DISMISSED: '投诉不成立' }[order.value?.complaintStatus] || '暂无投诉'));
const rewardStatusLabel = computed(() => ({ NONE: '暂无贡献值', FROZEN: '贡献值冻结中', GRANTED: '贡献值已发放', REJECTED: '贡献值已取消', CANCELED: '贡献值已取消' }[order.value?.rewardStatus] || '暂无贡献值'));
const completionMessage = computed(() => {
  if (order.value?.rewardStatus === 'CANCELED' && order.value?.complaintStatus === 'UPHELD') return '本次配送超时且投诉成立，已扣除贡献值';
  if (order.value?.rewardStatus === 'CANCELED') return '配送用时超过10分钟，本次贡献值奖励已取消';
  if (order.value?.rewardStatus === 'FROZEN') return '配送已完成，奖励处于投诉期冻结状态';
  return '';
});
const showRewardInfo = computed(() => order.value?.status === 'COMPLETED' || order.value?.rewardStatus && order.value.rewardStatus !== 'NONE');
onLoad((q) => { id.value = q.id; viewOnly.value = q.viewOnly === '1'; });
onShow(async () => { if (!id.value) return; await store.fetchMe(); await load(); });
onPullDownRefresh(() => runPullDownRefresh(async () => {
    if (id.value) {
      await store.fetchMe();
      await load();
    }
}));
async function load() {
  order.value = await api.orderDetail(id.value);
  const unavailable = order.value?.withdrawn || order.value?.status === 'EXPIRED';
  const viewingAsReceiver = order.value?.publisherId !== store.profile?.id;
  if (!viewOnly.value && unavailable && viewingAsReceiver && !invalidNoticeShown.value) {
    invalidNoticeShown.value = true;
    uni.showModal({ title: '提示', content: '订单已失效', showCancel: false });
  }
}
async function accept() { if (store.profile?.acceptBlocked) return uni.showToast({ title: '已被禁止接单', icon: 'none' }); try { await confirmThen('确认接单后请及时完成配送', () => api.acceptOrder(id.value)); await load(); } catch (error) { if (error?.message === 'cancelled') return; if (error?.code === 'ORDER_EXPIRED') invalidNoticeShown.value = true; await load(); } }
async function complete() { try { await confirmThen('确认物品已送达？', () => api.completeOrder(id.value)); await load(); } catch (error) { if (error?.message === 'cancelled') return; await load(); } }
async function expire() { try { await confirmThen('确认下架此订单？', () => api.expireOrder(id.value)); await load(); } catch (error) { if (error?.message === 'cancelled') return; if (error?.code === 'ORDER_EXPIRED') invalidNoticeShown.value = true; await load(); } }
function complaint() { uni.navigateTo({ url: `/pages/complaint-create/index?orderId=${id.value}` }); }
function preview(fileId) { wx.previewImage({ current: fileId, urls: order.value.imageFileIds }); }
function confirmThen(content, action) {
  return new Promise((resolve, reject) => uni.showModal({ title: '请确认', content, success: async ({ confirm }) => {
    if (!confirm) return reject(new Error('cancelled'));
    try { await action(); resolve(); } catch (error) { reject(error); }
  }}));
}
</script>

<style scoped>.order-image { width: 180rpx; height: 180rpx; margin: 16rpx 16rpx 0 0; border-radius: 6px; }.reward-area{margin-top:20rpx;padding-top:16rpx;border-top:1rpx solid #deebe7;line-height:1.9}.completion-message{color:#9a5a00;margin-bottom:8rpx}.complaint-action{background:#e52d2d;color:#fff}.complaint-action:active{background:#bd2020}</style>
