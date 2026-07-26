<template>
  <view class="page">
    <view class="page-title">帮打印</view>

    <view class="form-section">


      <view class="form-item">
        <view class="form-label">上传文件（Word / PDF）</view>
        <view v-for="(file, idx) in files" :key="idx" class="file-row">
          <text class="file-name">📄 {{ file.name }}</text>
          <text class="file-del" @click="removeFile(idx)">✕</text>
        </view>
        <view v-if="files.length < 5" class="upload-btn" @click="chooseFile">+ 选择文件</view>
      </view>

      <view class="form-item">
        <view class="form-label">打印要求</view>
        <textarea v-model="form.remark" class="form-textarea" placeholder="如：A4双面彩打/黑白/2份/装订…" />
      </view>

      <view class="form-item">
        <view class="form-label">
          贡献值投入
          <text class="label-hint">（余额 {{ contributionBalance }} 分）</text>
        </view>
        <view class="reward-picker">
          <view v-for="val in rewardOptions" :key="val" class="reward-chip" :class="{ active: form.contributionReward === val }" @click="form.contributionReward = val">
            <text class="chip-num">{{ val }}</text><text class="chip-label">分</text>
          </view>
          <view class="reward-chip" :class="{ active: showCustomInput }" @click="showCustomInput = true">
            <text class="chip-num">自定义</text>
          </view>
        </view>
        <input v-if="showCustomInput" v-model.number="form.contributionReward" class="form-input" type="number" placeholder="输入1-30之间的贡献值" style="margin-top: 14rpx;" />
      </view>

      <view class="form-item">
        <view class="form-label">接单时限</view>
        <picker :value="acceptLimitIndex" :range="acceptLimitOptions" @change="onAcceptLimitChange">
          <view class="form-picker">{{ acceptLimitOptions[acceptLimitIndex] }}</view>
        </picker>
      </view>

      <view class="form-item">
        <view class="form-label">配送时限</view>
        <picker :value="deliveryLimitIndex" :range="deliveryLimitOptions" @change="onDeliveryLimitChange">
          <view class="form-picker">{{ deliveryLimitOptions[deliveryLimitIndex] }}</view>
        </picker>
      </view>
    </view>

    <view class="submit-btn" @click="handleSubmit">发布订单</view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { api } from '@/utils/request';

const profile = uni.getStorageSync('cloudProfile') || {};
const contributionBalance = profile.contributionScore ?? 60;
const rewardOptions = [3, 5, 8, 10, 15];
const showCustomInput = ref(false);

const acceptLimitOptions = ['5分钟', '10分钟', '15分钟', '30分钟', '1小时', '不限时'];
const acceptLimitIndex = ref(2);
const deliveryLimitOptions = ['10分钟', '20分钟', '30分钟', '1小时', '2小时', '不限时'];
const deliveryLimitIndex = ref(1);

const form = reactive({ itemName: '', contributionReward: 5, remark: '' });
const files = ref([]);

function onAcceptLimitChange(e) { acceptLimitIndex.value = e.detail.value; }
function onDeliveryLimitChange(e) { deliveryLimitIndex.value = e.detail.value; }

async function chooseFile() {
  const r = await new Promise(resolve => wx.chooseMessageFile({ count: 5 - files.value.length, type: 'file', extension: ['doc', 'docx', 'pdf'], success: resolve }));
  for (const f of r.tempFiles) {
    try {
      const cloudPath = 'print/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + f.name;
      const up = await wx.cloud.uploadFile({ cloudPath, filePath: f.path });
      if (up.fileID) files.value.push({ fileID: up.fileID, name: f.name });
    } catch (e) { console.warn('上传失败', e); }
  }
}

function removeFile(idx) { files.value.splice(idx, 1); }

function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }

async function handleSubmit() {
  uni.showToast({ title: '发布中...', icon: 'loading' });
  try {
    await api.createOrder({
      clientRequestId: generateId(),
      orderType: 'printing',
      itemName: '打印店',
      remark: form.remark,
      contributionReward: form.contributionReward,
      imageFileIds: files.value.map(f => f.fileID),
      orderDetail: files.value.map(f => f.name).join('、'),
      acceptLimitMinutes: [5, 10, 15, 30, 60, 720][acceptLimitIndex.value] || 720,
      deliveryLimitMinutes: [10, 20, 30, 60, 120, 720][deliveryLimitIndex.value] || 720
    });
    uni.showToast({ title: '发布成功', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 800);
  } catch (e) {}
}
</script>

<style scoped>
.page { min-height: 100vh; background: #F3F8FD; padding: 24rpx; }
.page-title { font-size: 40rpx; font-weight: 700; color: #2A4257; text-align: center; padding: 32rpx 0 24rpx; }
.form-section { background: #fff; border-radius: 20rpx; padding: 24rpx; }
.form-item { margin-bottom: 24rpx; }
.form-label { font-size: 28rpx; color: #333; margin-bottom: 12rpx; }
.form-input { width: 100%; height: 80rpx; background: #f8f9fa; border-radius: 12rpx; padding: 0 20rpx; font-size: 28rpx; border: none; }
.form-textarea { width: 100%; min-height: 120rpx; background: #f8f9fa; border-radius: 12rpx; padding: 20rpx; font-size: 28rpx; border: none; }
.form-picker { height: 80rpx; line-height: 80rpx; background: #f8f9fa; border-radius: 12rpx; padding: 0 20rpx; font-size: 28rpx; color: #333; }
.file-row { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 20rpx; background: #f8f9fa; border-radius: 12rpx; margin-bottom: 10rpx; }
.file-name { font-size: 26rpx; color: #2A4257; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-del { font-size: 28rpx; color: #E57373; padding: 0 8rpx; }
.upload-btn { height: 80rpx; line-height: 80rpx; background: #EAF4FD; color: #3E9BF0; border-radius: 12rpx; text-align: center; font-size: 28rpx; border: 2rpx dashed #B0D4F1; }
.reward-picker { display: flex; flex-wrap: wrap; gap: 14rpx; }
.reward-chip { display: flex; align-items: center; gap: 4rpx; padding: 14rpx 24rpx; border-radius: 14rpx; background: #f5f6f8; color: #8AA3B8; font-size: 26rpx; }
.reward-chip.active { background: #FFECD2; color: #FF7043; font-weight: 600; }
.chip-label { font-size: 22rpx; }
.label-hint { font-size: 24rpx; color: #B0B0B0; font-weight: 400; }
.submit-btn { margin-top: 48rpx; background: #3E9BF0; color: #fff; text-align: center; padding: 28rpx 0; border-radius: 16rpx; font-size: 32rpx; font-weight: 600; }
</style>
