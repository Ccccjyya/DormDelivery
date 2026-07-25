<template>
  <view class="page">
    <view class="page-title">{{ currentTypeName }}</view>

    <view class="form-section">
      <!-- 外卖/快递/打印 的通用字段 -->
      <view v-if="selectedType !== 'grocery'" class="form-item">
        <view class="form-label">物品/商家名称</view>
        <input v-model="form.itemName" class="form-input" placeholder="请输入取件地点或商品名" />
      </view>

      <view v-if="selectedType === 'takeout'" class="form-item">
        <view class="form-label">取餐码/订单号</view>
        <input v-model="form.pickupCode" class="form-input" placeholder="如：取餐码A12" />
      </view>

      <view v-if="selectedType === 'package'" class="form-item">
        <view class="form-label">快递单号</view>
        <input v-model="form.trackingNo" class="form-input" placeholder="请输入快递单号" />
      </view>

      <view v-if="selectedType === 'printing'" class="form-item">
        <view class="form-label">文件名/格式</view>
        <input v-model="form.fileName" class="form-input" placeholder="如：论文终稿.docx" />
      </view>

      <!-- 便利店帮带 -->
      <view v-if="selectedType === 'grocery'">
        <view class="form-item">
          <view class="form-label">商品清单</view>
          <view class="item-list">
            <view v-for="(qty, id) in cartData" :key="id" class="il-row">
              <image v-if="productImgs[id]" :src="productImgs[id]" class="il-img" mode="aspectFill" />
              <view v-else class="il-img-place"></view>
              <view class="il-info">
                <text class="il-name">{{ getProductName(id) }}</text>
                <text class="il-price">¥{{ getProductPrice(id) }} x {{ qty }}</text>
              </view>
            </view>
          </view>
          <view class="il-total">合计 ¥{{ cartTotal.toFixed(2) }}</view>
        </view>
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
        <view class="form-label">
          贡献值投入
          <text class="label-hint">（余额 {{ contributionBalance }} 分）</text>
        </view>
        <view class="reward-picker">
          <view v-for="val in rewardOptions" :key="val" class="reward-chip" :class="{ active: !showCustomInput && form.contribution === val }" @click="selectReward(val)">
            <text class="chip-num">{{ val }}</text><text class="chip-label">分</text>
          </view>
          <view class="reward-chip" :class="{ active: showCustomInput }" @click="selectCustom">
            <text class="chip-num">自定义</text>
          </view>
        </view>
        <input v-if="showCustomInput" v-model.number="form.contribution" class="form-input" type="number" placeholder="输入1-30之间的贡献值" style="margin-top: 14rpx;" />
      </view>

      <view class="form-item">
        <view class="form-label">备注</view>
        <textarea v-model="form.remark" class="form-textarea small" placeholder="其他说明..." />
      </view>
    </view>

    <view class="submit-btn" @click="handleSubmit">发布订单</view>
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../utils/request';

const selectedType = ref('takeout');
const currentTypeName = ref('外卖');

const taskTypes = {
  takeout: '外卖代取',
  package: '快递代取',
  grocery: '便利店帮带',
  printing: '帮打印'
};

const acceptLimitOptions = ['5分钟', '10分钟', '15分钟', '30分钟', '1小时', '不限时'];
const acceptLimitIndex = ref(2);
const deliveryLimitOptions = ['10分钟', '20分钟', '30分钟', '1小时', '2小时', '不限时'];
const deliveryLimitIndex = ref(1);

const contributionBalance = ref(60);
const rewardOptions = [5, 10, 15, 20];
const showCustomInput = ref(false);

const form = reactive({
  itemName: '',
  pickupCode: '',
  trackingNo: '',
  itemList: '',
  fileName: '',
  remark: '',
  contribution: 5
});

const cartData = ref({});
const productNames = ref({});
const productPrices = ref({});
const productImgs = ref({});

const dormAddress = ref('');

const store = null;
try {
  const m = require('../../stores/user');
  if (m && m.useUserStore) {
    const s = m.useUserStore();
    const p = s.profile || uni.getStorageSync('cloudProfile') || {};
    dormAddress.value = p.fullRoomLabel || p.roomLabel || '';
  }
} catch (e) { dormAddress.value = ''; }

const cartTotal = computed(() => {
  let s = 0;
  for (const [id, qty] of Object.entries(cartData.value)) {
    s += qty * Number(productPrices.value[id] || 0);
  }
  return s;
});

function getProductName(id) { return productNames.value[id] || '商品'; }
function getProductPrice(id) { return productPrices.value[id] || ''; }
function selectReward(val) { showCustomInput.value = false; form.contribution = val; }
function selectCustom() { showCustomInput.value = true; }

onLoad((options) => {
  if (options?.type) {
    selectedType.value = options.type;
    currentTypeName.value = taskTypes[options.type] || '发布任务';
  }
  if (options?.type === 'grocery') {
    const cached = uni.getStorageSync('groceryCart');
    if (cached) {
      cartData.value = cached.cart || {};
      productNames.value = cached.names || {};
      productPrices.value = cached.prices || {};
      productImgs.value = cached.imgs || {};
      form.itemList = Object.entries(cached.cart || {}).map(([id, qty]) => (cached.names?.[id] || '商品') + ' x' + qty).join('\n');
    }
  }
});

function onAcceptLimitChange(e) { acceptLimitIndex.value = e.detail.value; }
function onDeliveryLimitChange(e) { deliveryLimitIndex.value = e.detail.value; }

function handleSubmit() {
  if (selectedType.value === 'grocery') {
    handleGrocerySubmit();
    return;
  }
  uni.showToast({ title: '发布功能开发中', icon: 'none' });
}

async function handleGrocerySubmit() {
  if (!form.itemList.trim()) {
    uni.showToast({ title: '商品清单为空', icon: 'none' });
    return;
  }
  uni.showToast({ title: '发布中...', icon: 'loading' });
  try {
    const result = await api.createOrder({
      clientRequestId: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 10),
      orderType: 'grocery',
      itemName: '便利店',
      remark: form.remark,
      orderDetail: form.itemList,
      pickupMode: 'dorm',
      destinationLabel: dormAddress.value || '宿舍楼',
      contributionReward: form.contribution,
      imageFileIds: [],
      acceptLimitMinutes: [5, 10, 15, 30, 60, 720][acceptLimitIndex.value] || 720,
      deliveryLimitMinutes: [10, 20, 30, 60, 120, 720][deliveryLimitIndex.value] || 720
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
  background: #f6f7f9;
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

.item-list { background: #f8f9fa; border-radius: 12rpx; padding: 20rpx; margin-bottom: 12rpx; }
.il-row { display: flex; align-items: center; gap: 16rpx; padding: 12rpx 0; border-bottom: 1rpx solid #e8e8e8; }
.il-row:last-child { border-bottom: none; }
.il-img { width: 80rpx; height: 80rpx; border-radius: 8rpx; flex-shrink: 0; background: #e0e0e0; }
.il-img-place { width: 80rpx; height: 80rpx; border-radius: 8rpx; flex-shrink: 0; background: #e0e0e0; }
.il-info { flex: 1; min-width: 0; }
.il-name { font-size: 26rpx; color: #2A4257; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.il-price { font-size: 24rpx; color: #FF7043; font-weight: 600; margin-top: 4rpx; display: block; }
.il-qty { font-size: 24rpx; color: #8AA3B8; min-width: 48rpx; text-align: center; }
.il-total { text-align: right; font-size: 28rpx; font-weight: 700; color: #333; margin-top: 12rpx; padding-top: 8rpx; border-top: 1rpx solid #e8e8e8; }

.label-hint { font-size: 22rpx; color: #999; font-weight: 400; margin-left: 8rpx; }
.reward-picker { display: flex; gap: 16rpx; flex-wrap: wrap; margin-top: 12rpx; }
.reward-chip { display: flex; align-items: baseline; gap: 4rpx; padding: 14rpx 28rpx; border-radius: 12rpx; background: #f0f0f0; border: 2rpx solid transparent; }
.reward-chip.active { background: #E3F1FD; border-color: #3E9BF0; }
.chip-num { font-size: 28rpx; font-weight: 700; color: #2A4257; }
.reward-chip.active .chip-num { color: #3E9BF0; }
.chip-label { font-size: 22rpx; color: #8AA3B8; }

.form-textarea {
  width: 100%;
  min-height: 120rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  border: none;
}
.form-textarea.small { min-height: 100rpx; }

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
