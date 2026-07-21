<template>
  <view class="page">
    <view class="title">投诉详情</view>
    <view v-if="errorMessage" class="empty">{{ errorMessage }}</view>
    <view class="card" v-if="item">
      <view>订单编号：{{ item.order?.orderNo || '未记录' }}</view><view>订单：{{ item.order?.itemName || item.orderSnapshot?.itemName || '未记录' }}</view><view>订单状态：已完成</view><view v-if="item.order?.completedAt || item.orderSnapshot?.completedAt">完成时间：{{ formatDateTime(item.order?.completedAt || item.orderSnapshot?.completedAt) }}</view><view>发布者：{{ item.order?.publisherSnapshot?.displayName || item.orderSnapshot?.publisherSnapshot?.displayName || '暂未记录' }}</view><view>接单者：{{ item.order?.receiverSnapshot?.displayName || item.orderSnapshot?.receiverSnapshot?.displayName || '暂未记录' }}</view><view>投诉原因：{{ item.reason }}</view><view>提交时间：{{ formatDateTime(item.createdAt) }}</view><view>审核状态：{{ label(item.status) }}</view><view v-if="item.reviewRemark">审核备注：{{ item.reviewRemark }}</view><view v-if="item.reviewerName">审核人：{{ item.reviewerName }}</view><view v-if="item.reviewedAt">审核时间：{{ formatDateTime(item.reviewedAt) }}</view>
    </view>
    <view v-if="item?.imageFileIds?.length" class="card"><view>证据图片</view><image v-for="url in imageUrls" :key="url" class="evidence" :src="url" mode="aspectFill" @click="preview(url)" /></view>
    <textarea v-if="item?.status === 'PENDING'" class="input" v-model="opinion" placeholder="审核备注（可选）" />
    <button class="btn danger" :loading="reviewing" v-if="item?.status === 'PENDING'" @click="review('UPHELD')">投诉成立</button>
    <button class="btn" :loading="reviewing" v-if="item?.status === 'PENDING'" @click="review('DISMISSED')">投诉不成立</button>
  </view>
</template>

<script setup>
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { api } from '../../utils/request'; import { formatDateTime } from '../../utils/orderDisplay';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
const id = ref(null);
const item = ref(null);
const opinion = ref('');
const imageUrls = ref([]); const reviewing = ref(false); const errorMessage = ref('');
onLoad(async (q) => {
  if (!q.complaintId || !String(q.complaintId).trim()) { uni.showToast({ title: '投诉信息无效', icon: 'none' }); return; }
  id.value = String(q.complaintId).trim();
  await load();
});
async function load() { errorMessage.value='';try { item.value = await api.adminComplaintDetail(id.value); imageUrls.value=[];if (item.value.imageFileIds?.length) { const result = await wx.cloud.getTempFileURL({ fileList: item.value.imageFileIds }); imageUrls.value = result.fileList.filter((file) => file.status === 0 && file.tempFileURL).map((file) => file.tempFileURL); } } catch(error) { errorMessage.value=typeof error?.code==='string'&&error?.message?error.message:'加载失败，请稍后重试'; } }
onPullDownRefresh(() => runPullDownRefresh(() => id.value ? load() : undefined));
async function review(status) {
  if (reviewing.value) return; reviewing.value = true; try { await api.reviewComplaint({ complaintId: id.value, decision: status, reviewRemark: opinion.value }); await load(); uni.showToast({ title: '审核完成', icon: 'success' }); } finally { reviewing.value = false; }
}
function label(v) { return ({ PENDING: '待审核', UPHELD: '投诉成立', DISMISSED: '投诉不成立' })[v] || ''; }
function preview(url) { wx.previewImage({ current: url, urls: imageUrls.value }); }
</script>
<style scoped>.card{line-height:1.9}.evidence{width:180rpx;height:180rpx;margin:16rpx 16rpx 0 0;border-radius:6px}</style>
