<template>
  <view class="page">
    <view class="page-title">帮打印</view>

    <view class="form-section">
      <view class="form-item">
        <view class="form-label">打印店位置</view>
        <input v-model="form.itemName" class="form-input" placeholder="如：图书馆打印店/B栋打印店" />
      </view>

      <view class="form-item">
        <view class="form-label">文件名</view>
        <input v-model="form.fileName" class="form-input" placeholder="如：论文终稿.docx" />
      </view>

      <view class="form-item">
        <view class="form-label">
          贡献值投入
          <text class="label-hint">（余额 {{ contributionBalance }} 分）</text>
        </view>
        <view class="reward-picker">
          <view
            v-for="val in rewardOptions"
            :key="val"
            class="reward-chip"
            :class="{ active: form.contributionReward === val }"
            @click="form.contributionReward = val"
          >
            <text class="chip-num">{{ val }}</text>
            <text class="chip-label">分</text>
          </view>
          <view
            class="reward-chip"
            :class="{ active: showCustomInput }"
            @click="showCustomInput = true"
          >
            <text class="chip-num">自定义</text>
          </view>
        </view>
        <input
          v-if="showCustomInput"
          v-model.number="form.contributionReward"
          class="form-input"
          type="number"
          placeholder="输入1-30之间的贡献值"
          style="margin-top: 14rpx;"
        />
      </view>

      <view class="form-item">
        <view class="form-label">打印要求</view>
        <textarea v-model="form.remark" class="form-textarea" placeholder="如：A4双面彩打/黑白/2份/装订……" />
      </view>

      <view class="form-item">
        <view class="form-label">完成时限</view>
        <picker :value="timeLimitIndex" :range="timeLimitOptions" @change="onTimeLimitChange">
          <view class="form-picker">{{ timeLimitOptions[timeLimitIndex] }}</view>
        </picker>
      </view>
    </view>

    <view class="submit-btn" @click="handleSubmit">发布订单</view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { api } from '@/utils/request';
import { useUserStore } from '@/stores/user';

const profile = uni.getStorageSync('cloudProfile') || {};
const contributionBalance = profile.contributionScore ?? 60;
const rewardOptions = [3, 5, 8, 10, 15];
const showCustomInput = ref(false);

const timeLimitOptions = ['10分钟', '20分钟', '30分钟', '1小时', '2小时', '不限时'];
const timeLimitIndex = ref(1);

const form = reactive({
  itemName: '',
  fileName: '',
  contributionReward: 5,
  remark: ''
});

function onTimeLimitChange(e) {
  timeLimitIndex.value = e.detail.value;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function handleSubmit() {
  if (!(form.itemName || '').trim()) {
    uni.showToast({ title: '请填写打印店位置', icon: 'none' });
    return;
  }
  const itemName = (form.itemName || '').trim();
  let remark = form.remark || '';
  if (form.fileName) {
    remark = '文件：' + form.fileName + (remark ? ' | ' + remark : '');
  }
  uni.showToast({ title: '发布中...', icon: 'loading' });
  try {
    const result = await api.createOrder({
      clientRequestId: generateId(),
      orderType: 'printing',
      itemName,
      remark,
      contributionReward: form.contributionReward,
      imageFileIds: [],
      timeLimitMinutes: [10, 20, 30, 60, 120, 720][timeLimitIndex.value] || 720
    });
    if (result?.orderId) {
      uni.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => uni.navigateBack(), 800);
    }
  } catch (e) {}
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #F3F8FD;
  padding: 24rpx;
}

.page-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #2A4257;
  text-align: center;
  padding: 32rpx 0 24rpx;
}

.form-section {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 12rpx;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  border: none;
}

.form-textarea {
  width: 100%;
  min-height: 120rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  border: none;
}

.form-picker {
  height: 80rpx;
  line-height: 80rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: #333;
}

.submit-btn {
  margin-top: 48rpx;
  background: #3E9BF0;
  color: #fff;
  text-align: center;
  padding: 28rpx 0;
  border-radius: 16rpx;
  font-size: 32rpx;
  font-weight: 600;
}
</style>
