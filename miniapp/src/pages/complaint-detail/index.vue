<template>
  <view class="page" v-if="item">
    <view class="title">投诉详情</view>
    <view class="card detail">
      <view>关联订单：{{ item.orderSnapshot?.itemName || '订单信息' }}</view>
      <view>订单编号：{{ item.orderNo || '未记录' }}</view>
      <view>被投诉人：{{ item.orderSnapshot?.receiverSnapshot?.displayName || '暂未记录' }}</view>
      <view>投诉原因：{{ item.reason }}</view>
      <view>审核状态：{{ statusLabel(item.status) }}</view>
      <view v-if="item.reviewRemark">审核备注：{{ item.reviewRemark }}</view>
      <view v-if="item.reviewedAt">审核时间：{{ formatDateTime(item.reviewedAt) }}</view>
    </view>
    <view v-if="imageUrls.length" class="card"><view class="section-label">证据图片</view><image v-for="url in imageUrls" :key="url" :src="url" class="evidence" mode="aspectFill" @click="preview(url)" /></view>
  </view>
</template>

<script setup>
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { api } from '../../utils/request';
import { formatDateTime } from '../../utils/orderDisplay';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
const complaintId = ref(''); const item = ref(null); const imageUrls = ref([]);
function statusLabel(value) { return ({ PENDING: '待审核', UPHELD: '投诉成立', DISMISSED: '投诉不成立' })[value] || '待审核'; }
async function loadImages(fileIds = []) { imageUrls.value = []; if (!fileIds.length) return; const result = await wx.cloud.getTempFileURL({ fileList: fileIds }); imageUrls.value = result.fileList.filter((file) => file.status === 0 && file.tempFileURL).map((file) => file.tempFileURL); }
async function load() { if (!complaintId.value) return; item.value = await api.complaintDetail(complaintId.value); await loadImages(item.value.imageFileIds || []); }
onLoad(async (query) => { complaintId.value = String(query.complaintId || '').trim(); await load(); });
onPullDownRefresh(() => runPullDownRefresh(load));
function preview(url) { wx.previewImage({ current: url, urls: imageUrls.value }); }
</script>

<style scoped>.detail{line-height:2}.section-label{font-weight:600;margin-bottom:14rpx}.evidence{width:180rpx;height:180rpx;margin:0 16rpx 16rpx 0;border-radius:6px}</style>
