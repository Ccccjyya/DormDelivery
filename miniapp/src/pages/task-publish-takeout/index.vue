<template>
  <view class="page">
    <view class="page-title">外卖代取</view>

    <view class="form-section">
      <view class="form-item">
        <view class="form-label">取件方式</view>
        <view class="pickup-toggle">
          <view
            class="toggle-option"
            :class="{ active: pickupMode === 'dorm' }"
            @click="switchPickupMode('dorm')"
          >
            <text class="toggle-icon">🏠</text>
            <text class="toggle-text">宿舍楼下</text>
          </view>
          <view
            class="toggle-option"
            :class="{ active: pickupMode === 'station' }"
            @click="switchPickupMode('station')"
          >
            <text class="toggle-icon">📍</text>
            <text class="toggle-text">外卖驿站</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <view class="form-label">{{ pickupMode === 'dorm' ? '送达地址' : '驿站位置' }}</view>
        <view v-if="pickupMode === 'dorm'" class="form-readonly">
          <text class="readonly-icon">📬</text>
          <text class="readonly-text">{{ dormAddress }}</text>
        </view>
        <input
          v-else
          v-model="form.stationAddress"
          class="form-input"
          placeholder="如：南门外美团取餐柜/顺丰快递旁"
        />
      </view>

      <!-- 宿舍楼下：外卖信息 | 外卖驿站：取餐码 -->
      <view v-if="pickupMode === 'dorm'" class="form-item">
        <view class="form-label">外卖信息</view>
        <textarea v-model="form.orderDetail" class="form-textarea form-textarea-sm" placeholder="如：二食堂黄焖鸡+可乐" />
      </view>
      <view v-else class="form-item">
        <view class="form-label">取餐码/订单号</view>
        <input v-model="form.pickupCode" class="form-input" placeholder="如：取餐码A12" />
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
        <view class="form-label">外卖照片 <text class="label-hint">（选填，方便接单人辨认）</text></view>
        <view class="photo-grid">
          <view
            v-for="(img, idx) in photos"
            :key="idx"
            class="photo-item"
            @click="previewPhoto(idx)"
          >
            <image :src="img" class="photo-img" mode="aspectFill" />
            <view class="photo-delete" @click.stop="deletePhoto(idx)">✕</view>
          </view>
          <view
            v-if="photos.length < 4"
            class="photo-add"
            @click="choosePhoto"
          >
            <text class="photo-add-icon">+</text>
            <text class="photo-add-text">{{ photos.length === 0 ? '添加照片' : `${photos.length}/4` }}</text>
          </view>
        </view>
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

      <view class="form-item">
        <view class="form-label">备注</view>
        <textarea v-model="form.remark" class="form-textarea" placeholder="如：放前台/放门口/加醋……" />
      </view>
    </view>

    <view class="submit-btn" @click="handleSubmit">发布订单</view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { api } from '@/utils/request';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const pickupMode = ref('dorm');

// 从用户 Profile 读取宿舍信息（被 toClientUser 拍平了）
const profile = userStore.profile || uni.getStorageSync('cloudProfile') || {};
const dormName = profile.dormBuildingName || '';
const dormFloor = profile.floorNo;
const dormRoom = profile.roomNo || '';

let addr = '';
if (dormName && dormFloor && dormRoom) {
  addr = `${dormName} ${dormFloor}层 ${dormRoom}室`;
} else if (dormName) {
  addr = dormName;
}
const dormAddress = ref(addr || '请先完善宿舍资料');

const photos = ref([]);

const form = reactive({
  stationAddress: '',
  orderDetail: '',
  pickupCode: '',
  contributionReward: 5,
  remark: ''
});

function switchPickupMode(mode) {
  pickupMode.value = mode;
}

const rewardOptions = [3, 5, 8, 10, 15];

// 从用户 Profile 读取贡献值余额
const contributionBalance = profile.contributionScore ?? 60;

const showCustomInput = ref(false);

const acceptLimitOptions = ['5分钟', '10分钟', '15分钟', '30分钟', '1小时', '不限时'];
const acceptLimitIndex = ref(2);
const deliveryLimitOptions = ['10分钟', '20分钟', '30分钟', '1小时', '2小时', '不限时'];
const deliveryLimitIndex = ref(1);

function choosePhoto() {
  const remain = 4 - photos.value.length;
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      photos.value.push(...res.tempFilePaths);
    }
  });
}

function previewPhoto(idx) {
  uni.previewImage({
    current: idx,
    urls: photos.value
  });
}

function deletePhoto(idx) {
  photos.value.splice(idx, 1);
}

function onAcceptLimitChange(e) { acceptLimitIndex.value = e.detail.value; }
function onDeliveryLimitChange(e) { deliveryLimitIndex.value = e.detail.value; }

function selectReward(val) { showCustomInput.value = false; form.contributionReward = val; }
function selectCustom() { showCustomInput.value = true; }

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function handleSubmit() {
  // 构建 itemName
  let itemName = '';
  if (pickupMode.value === 'dorm') {
    if (!dormAddress.value || dormAddress.value === '请先完善宿舍资料') {
      uni.showToast({ title: '请先完善宿舍资料', icon: 'none' });
      return;
    }
    itemName = '宿舍楼下';
    if (!form.orderDetail.trim()) {
      uni.showToast({ title: '请填写外卖信息', icon: 'none' });
      return;
    }
  } else {
    if (!form.stationAddress.trim()) {
      uni.showToast({ title: '请填写驿站位置', icon: 'none' });
      return;
    }
    itemName = form.stationAddress.trim();
  }

  // 构建备注（含外卖信息或取餐码）
  let remark = form.remark || '';
  if (pickupMode.value === 'dorm' && form.orderDetail) {
    remark = `下单：${form.orderDetail}` + (remark ? ` | ${remark}` : '');
  } else if (pickupMode.value === 'station' && form.pickupCode) {
    remark = `取餐码：${form.pickupCode}` + (remark ? ` | ${remark}` : '');
  }

  uni.showToast({ title: '发布中...', icon: 'loading' });
  try {
    const result = await api.createOrder({
      clientRequestId: generateId(),
      orderType: 'takeout',
      itemName,
      remark,
      orderDetail: form.orderDetail,
      pickupMode: pickupMode.value,
      destinationLabel: pickupMode.value === 'dorm' ? dormAddress.value : '',
      contributionReward: form.contributionReward,
      imageFileIds: [],
      acceptLimitMinutes: [5, 10, 15, 30, 60, 720][acceptLimitIndex.value] || 720,
      deliveryLimitMinutes: [10, 20, 30, 60, 120, 720][deliveryLimitIndex.value] || 720
    });
    if (result?.orderId) {
      uni.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => uni.navigateBack(), 800);
    }
  } catch (e) {
    // 错误已在 request.js 统一处理
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

.form-textarea-sm {
  min-height: 80rpx;
  height: 80rpx;
}

.label-hint {
  font-size: 22rpx;
  color: #8AA3B8;
  font-weight: normal;
}

/* ---- 取件方式切换 ---- */
.pickup-toggle {
  display: flex;
  gap: 16rpx;
}

.toggle-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 80rpx;
  border-radius: 14rpx;
  border: 2rpx solid #E3F1FD;
  background: #f8f9fa;
  transition: all 0.2s;
}

.toggle-option.active {
  background: #E3F1FD;
  border-color: #3E9BF0;
  box-shadow: 0 0 0 2rpx rgba(62, 155, 240, 0.15);
}

.toggle-icon {
  font-size: 28rpx;
}

.toggle-text {
  font-size: 28rpx;
  font-weight: 500;
  color: #2A4257;
}

.toggle-option.active .toggle-text {
  color: #3E9BF0;
  font-weight: 600;
}

/* ---- 自动填入地址只读区 ---- */
.form-readonly {
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 80rpx;
  background: #E3F1FD;
  border-radius: 12rpx;
  padding: 0 20rpx;
  border: 1rpx solid #BBDEFB;
}

.readonly-icon {
  font-size: 28rpx;
  flex-shrink: 0;
}

.readonly-text {
  font-size: 28rpx;
  color: #2A4257;
  font-weight: 500;
}

/* ---- 贡献值投入 ---- */
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
  transition: all 0.2s;
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

.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.photo-item {
  width: 156rpx;
  height: 156rpx;
  border-radius: 12rpx;
  overflow: hidden;
  position: relative;
}

.photo-img {
  width: 100%;
  height: 100%;
}

.photo-delete {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

.photo-add {
  width: 156rpx;
  height: 156rpx;
  border-radius: 12rpx;
  border: 2rpx dashed #C9DFF2;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.photo-add-icon {
  font-size: 44rpx;
  color: #3E9BF0;
  line-height: 1;
}

.photo-add-text {
  font-size: 22rpx;
  color: #8AA3B8;
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
