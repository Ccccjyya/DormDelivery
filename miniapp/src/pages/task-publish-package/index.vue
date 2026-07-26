<template>
  <view class="page">
    <view class="page-title">快递代取</view>

    <view class="form-section">
      <view class="form-item">
        <view class="form-label">取件地点 <text class="label-hint">*必填</text></view>
        <input v-model="form.itemName" class="form-input" placeholder="如：菜鸟驿站/快递柜" />
      </view>

      <view class="form-item">
        <view class="form-label">取件码 <text class="label-hint">*必填</text></view>
        <input v-model="form.trackingNo" class="form-input" placeholder="请输入取件码" />
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

      <view class="form-item">
        <view class="form-label">任务描述 <text class="label-hint">*必填</text></view>
        <textarea v-model="form.orderDetail" class="form-textarea" placeholder="如：包裹数量、大小、时间、其他要求等" />
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
            :class="{ active: !showCustomInput && form.contributionReward === val }"
            @click="selectReward(val)"
          >
            <text class="chip-num">{{ val }}</text>
            <text class="chip-label">分</text>
          </view>
          <view
            class="reward-chip"
            :class="{ active: showCustomInput }"
            @click="selectCustom"
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

const form = reactive({
  itemName: '',
  trackingNo: '',
  orderDetail: '',
  contributionReward: 5
});

function onAcceptLimitChange(e) { acceptLimitIndex.value = e.detail.value; }
function onDeliveryLimitChange(e) { deliveryLimitIndex.value = e.detail.value; }

function selectReward(val) {
  showCustomInput.value = false;
  form.contributionReward = val;
}

function selectCustom() {
  showCustomInput.value = true;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function handleSubmit() {
  const itemName = (form.itemName || '').trim();
  if (!itemName) return uni.showToast({ title: '请填写取件地点', icon: 'none' });

  const trackingNo = (form.trackingNo || '').trim();
  if (!trackingNo) return uni.showToast({ title: '请填写取件码', icon: 'none' });

  const orderDetail = (form.orderDetail || '').trim();
  if (!orderDetail) return uni.showToast({ title: '请填写任务描述', icon: 'none' });

  const reward = Number(form.contributionReward);
  if (!Number.isInteger(reward) || reward < 1 || reward > 30) {
    return uni.showToast({ title: '贡献值投入须为1-30整数', icon: 'none' });
  }

  uni.showToast({ title: '发布中...', icon: 'loading' });
  try {
    const result = await api.createOrder({
      clientRequestId: generateId(),
      orderType: 'package',
      itemName,
      orderDetail,
      remark: '',
      pickupCode: trackingNo,
      contributionReward: reward,
      imageFileIds: [],
      acceptLimitMinutes: [5, 10, 15, 30, 60, 720][acceptLimitIndex.value] || 720,
      deliveryLimitMinutes: [10, 20, 30, 60, 120, 720][deliveryLimitIndex.value] || 720
    });
    if (result?.orderId) {
      uni.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => uni.navigateBack(), 800);
    }
  } catch (e) {
    uni.hideLoading();
  }
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

.label-hint {
  font-size: 22rpx;
  color: #8AA3B8;
  font-weight: normal;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  border: none;
  box-sizing: border-box;
}

.form-textarea {
  width: 100%;
  min-height: 120rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  border: none;
  box-sizing: border-box;
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

.reward-picker {
  display: flex;
  gap: 14rpx;
  flex-wrap: wrap;
}

.reward-chip {
  flex: 1;
  min-width: 110rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
  padding: 16rpx 0;
  border-radius: 14rpx;
  border: 2rpx solid #E3F1FD;
  background: #f8f9fa;
}

.reward-chip.active {
  background: #3E9BF0;
  border-color: #3E9BF0;
}

.chip-num {
  font-size: 32rpx;
  font-weight: 700;
  color: #2A4257;
}

.reward-chip.active .chip-num {
  color: #fff;
}

.chip-label {
  font-size: 22rpx;
  color: #8AA3B8;
}

.reward-chip.active .chip-label {
  color: rgba(255, 255, 255, 0.8);
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