<template>
  <view class="page">
    <view class="page-title">{{ currentTypeName }}</view>

    <view class="form-section">
      <view class="form-item">
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

      <view v-if="selectedType === 'grocery'" class="form-item">
        <view class="form-label">商品清单</view>
        <textarea v-model="form.itemList" class="form-textarea" placeholder="请列出需要代买的商品" />
      </view>

      <view v-if="selectedType === 'printing'" class="form-item">
        <view class="form-label">文件名/格式</view>
        <input v-model="form.fileName" class="form-input" placeholder="如：论文终稿.docx" />
      </view>

      <view class="form-item">
        <view class="form-label">完成时限</view>
        <picker :value="timeLimitIndex" :range="timeLimitOptions" @change="onTimeLimitChange">
          <view class="form-picker">{{ timeLimitOptions[timeLimitIndex] }}</view>
        </picker>
      </view>

      <view class="form-item">
        <view class="form-label">备注</view>
        <textarea v-model="form.remark" class="form-textarea" placeholder="其他说明..." />
      </view>
    </view>

    <view class="submit-btn" @click="handleSubmit">发布订单</view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { onLoad } from '@dcloudio/uni-app';

const selectedType = ref('takeout');

const currentTypeName = ref('外卖');

const taskTypes = {
  takeout: '外卖代取',
  package: '快递代取',
  grocery: '便利店帮带',
  printing: '帮打印'
};

const timeLimitOptions = ['10分钟', '20分钟', '30分钟', '1小时', '2小时', '不限时'];
const timeLimitIndex = ref(1);

const form = reactive({
  itemName: '',
  pickupCode: '',
  trackingNo: '',
  itemList: '',
  fileName: '',
  remark: ''
});

onLoad((options) => {
  if (options?.type) {
    selectedType.value = options.type;
    currentTypeName.value = taskTypes[options.type] || '发布任务';
  }
});

function onTimeLimitChange(e) {
  timeLimitIndex.value = e.detail.value;
}

function handleSubmit() {
  uni.showToast({ title: '发布功能开发中', icon: 'none' });
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
