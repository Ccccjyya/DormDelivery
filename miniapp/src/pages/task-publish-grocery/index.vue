<template>
  <view class="page">
    <view class="search-bar">
      <view class="search-input">
        <text class="search-icon">🔍</text>
        <text class="search-placeholder">搜索门店商品</text>
      </view>
      <view class="search-actions">
        <text class="action-icon">⋯</text>
        <text class="action-icon" style="margin-left: 20rpx;">⊙</text>
      </view>
    </view>

    <view class="body">
      <scroll-view scroll-y class="cat-list">
        <view
          v-for="cat in categories"
          :key="cat.key"
          class="cat-item"
          :class="{ active: activeCat === cat.key }"
          @click="activeCat = cat.key"
        >
          <view class="cat-icon"></view>
          <text class="cat-name">{{ cat.name }}</text>
        </view>
      </scroll-view>

      <scroll-view scroll-y class="product-list">
        <view class="product-subtabs">
          <text
            v-for="sub in activeSubcats"
            :key="sub"
            class="subtab"
            :class="{ active: activeSub === sub }"
            @click="activeSub = sub"
          >
            {{ sub }}
          </text>
        </view>

        <view class="empty-products">
          <text class="empty-text">该分类下暂无商品</text>
        </view>
      </scroll-view>
    </view>

    <view class="bottom-bar">
      <view class="bb-info">
        <text class="bb-amount">¥0.00</text>
      </view>
      <text class="bb-btn">未选购商品</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const categories = [
  { key: 'bakery',     name: '面包甜点', subs: ['面包', '甜点'] },
  { key: 'instant',    name: '便当面点', subs: ['盒饭', '粥面类'] },
  { key: 'sushi',      name: '寿司饭团', subs: ['寿司', '饭团'] },
  { key: 'salad',      name: '沙拉轻食', subs: ['沙拉', '菜肴'] },
  { key: 'sandwich',   name: '三明治',   subs: [] },
  { key: 'icecream',   name: '冰淇淋',   subs: [] },
  { key: 'liquor',     name: '酒品',     subs: [] },
  { key: 'snack',      name: '休闲零食', subs: ['糖', '薯片', '巧克力', '饼干', '果冻'] },
  { key: 'drink',      name: '水饮饮料', subs: ['茶饮', '饮用水', '饮料', '乳制品'] },
  { key: 'case',       name: '整箱好物', subs: [] },
  { key: 'fastfood',   name: '方便速食', subs: [] }
];
const activeCat = ref('bakery');
const activeSub = ref('');

const activeSubcats = computed(() => {
  const cat = categories.find(c => c.key === activeCat.value);
  return cat ? ['全部', ...cat.subs] : ['全部'];
});

watch(activeCat, () => {
  activeSub.value = '全部';
});
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: #fff; }
.search-bar { display: flex; align-items: center; padding: 16rpx 24rpx; background: #fff; border-bottom: 1rpx solid #F0F0F0; }
.search-input { flex: 1; display: flex; align-items: center; height: 64rpx; background: #F5F6F8; border-radius: 32rpx; padding: 0 20rpx; }
.search-icon { font-size: 26rpx; color: #999; margin-right: 10rpx; }
.search-placeholder { font-size: 26rpx; color: #B0B0B0; }
.search-actions { display: flex; align-items: center; margin-left: 20rpx; }
.action-icon { font-size: 36rpx; color: #555; }

.body { flex: 1; display: flex; min-height: 0; padding-bottom: 140rpx; }
.cat-list { width: 170rpx; background: #F5F6F8; height: 100%; padding-left: 0; margin-left: 0; }
.cat-item { display: flex; flex-direction: column; align-items: center; padding: 24rpx 0; position: relative; margin-left: 0; }
.cat-item.active { background: #fff; }
.cat-item.active::before { content: ''; position: absolute; left: 0; top: 24rpx; bottom: 24rpx; width: 6rpx; background: #3E9BF0; border-radius: 0 4rpx 4rpx 0; }
.cat-icon { width: 56rpx; height: 56rpx; border-radius: 50%; background: #E3F1FD; margin-bottom: 10rpx; }
.cat-name { font-size: 24rpx; color: #5A7A92; }
.cat-item.active .cat-name { color: #3E9BF0; font-weight: 600; }

.product-list { flex: 1; background: #fff; height: 100%; }
.product-subtabs { display: flex; align-items: center; gap: 20rpx; padding: 20rpx 24rpx; border-bottom: 1rpx solid #F0F0F0; }
.subtab { font-size: 28rpx; color: #5A7A92; padding: 8rpx 0; position: relative; }
.subtab.active { font-weight: 700; color: #2A4257; }
.subtab.active::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 40rpx; height: 4rpx; background: #3E9BF0; border-radius: 2rpx; }
.subtab.more { margin-left: auto; display: flex; align-items: center; gap: 6rpx; }
.caret { font-size: 20rpx; color: #999; }

.empty-products { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #B0B0B0; }

.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 100; display: flex; align-items: center; padding: 20rpx 28rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); background: #fff; border-top: 1rpx solid #F0F0F0; }
.bb-info { flex: 1; }
.bb-amount { font-size: 36rpx; font-weight: 700; color: #333; }
.bb-btn { background: #E0E0E0; color: #999; padding: 18rpx 40rpx; border-radius: 40rpx; font-size: 28rpx; }
</style>