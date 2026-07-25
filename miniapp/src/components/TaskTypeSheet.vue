<template>
  <view class="sheet-mask" @click="handleClose">
    <view class="sheet-container" @click.stop>
      <view class="sheet-header">
        <text class="sheet-title">选择任务类型</text>
        <view class="sheet-close" @click="handleClose">✕</view>
      </view>

      <view class="sheet-body">
        <view
          v-for="type in taskTypes"
          :key="type.key"
          class="type-card"
          :class="type.key"
          @click="handleSelect(type.key)"
        >
          <view class="type-icon">{{ type.icon }}</view>
          <view class="type-info">
            <view class="type-name">{{ type.name }}</view>
            <view class="type-desc">{{ type.desc }}</view>
          </view>
          <view class="type-arrow">›</view>
        </view>
      </view>

      <view class="sheet-footer">
        <view class="cancel-btn" @click="handleClose">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup>
const emit = defineEmits(['close', 'select']);

const taskTypes = [
  {
    key: 'takeout',
    icon: '🥡',
    name: '外卖代取',
    desc: '食堂/外卖柜/商家取餐'
  },
  {
    key: 'package',
    icon: '📦',
    name: '快递代取',
    desc: '驿站/快递柜取件'
  },
  {
    key: 'grocery',
    icon: '🏪',
    name: '便利店帮带',
    desc: '楼下超市顺便代买'
  },
  {
    key: 'printing',
    icon: '🖨️',
    name: '帮打印',
    desc: '打印店取文件'
  }
];

function handleClose() {
  emit('close');
}

function handleSelect(key) {
  emit('select', key);
}
</script>

<style scoped>
.sheet-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.sheet-container {
  width: 100%;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 32rpx 24rpx;
  border-bottom: 1rpx solid #f0f2f1;
}

.sheet-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1B3A57;
}

.sheet-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #999;
}

.sheet-body {
  padding: 24rpx 32rpx;
}

.type-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 16rpx;
  border-radius: 20rpx;
  border: 1rpx solid #e8eceb;
  transition: all 0.15s;
}

.type-card:active {
  background: #f8f9fa;
  transform: scale(0.98);
}

.type-card.takeout { background: #fffaf2; border-color: #ffe4b5; }
.type-card.package { background: #f2faff; border-color: #b5d4ff; }
.type-card.grocery { background: #f2fff5; border-color: #b5ffd4; }
.type-card.printing { background: #fff2f8; border-color: #ffb5d4; }

.type-icon {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  flex-shrink: 0;
}

.type-info {
  flex: 1;
  min-width: 0;
}

.type-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #1B3A57;
}

.type-desc {
  font-size: 24rpx;
  color: #7A93A8;
  margin-top: 6rpx;
}

.type-arrow {
  font-size: 40rpx;
  color: #ccc;
  flex-shrink: 0;
}

.sheet-footer {
  padding: 16rpx 32rpx 32rpx;
}

.cancel-btn {
  text-align: center;
  font-size: 32rpx;
  color: #666;
  padding: 24rpx 0;
  background: #f6f7f9;
  border-radius: 16rpx;
}
</style>
