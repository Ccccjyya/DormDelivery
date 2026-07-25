<template>
  <view class="page">
    <view class="search-bar">
      <view class="search-input" @click="onSearchClick">
        <text class="search-icon">🔍</text>
        <input v-if="searching" class="search-real" v-model="keyword" focus placeholder="搜索商品" @blur="closeSearch" />
        <text v-else class="search-placeholder">搜索门店商品</text>
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
          <text class="cat-name">{{ cat.name }}</text>
        </view>
      </scroll-view>

      <view class="product-list">
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

        <view v-if="!loaded" class="empty-products"><text class="empty-text">加载中...</text></view>
        <view v-else-if="filteredProducts.length === 0" class="empty-products">
          <text class="empty-text">该分类下暂无商品</text>
        </view>
        <view v-else class="product-list-vertical">
          <view v-for="p in filteredProducts" :key="p._id" class="p-row">
            <image v-if="p._img" :src="p._img" class="p-img" mode="aspectFill" />
            <image v-else-if="p.imageFileId" :src="p.imageFileId" class="p-img" mode="aspectFill" />
            <view v-else class="p-img-placeholder"><text class="ph-text">无图</text></view>
            <view class="p-info">
              <text class="p-name">{{ p.name }}</text>
              <text class="p-price">¥{{ p.price }}</text>
            </view>
            <view class="p-action">
              <view v-if="cart[p._id]" class="qty-control">
                <view class="qty-btn" @click="decQty(p)">−</view>
                <text class="qty-num">{{ cart[p._id] }}</text>
                <view class="qty-btn" @click="incQty(p)">+</view>
              </view>
              <view v-else class="add-btn" @click="incQty(p)">+</view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="bottom-bar">
      <view class="bb-info">
        <text class="bb-amount">¥{{ totalAmount.toFixed(2) }}</text>
        <text class="bb-count">已选 {{ totalCount }} 件</text>
      </view>
      <text class="bb-btn" :class="{ active: totalCount > 0 }" @click="goPublish">{{ totalCount > 0 ? '去发单' : '未选购商品' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../../utils/request';
import { initCloudBase } from '../../config/cloudbase';
import { useUserStore } from '../../stores/user';

const defaultCats = [
  { key: 'bakery',   name: '面包甜点', subs: ['面包', '甜点'] },
  { key: 'instant',  name: '便当面点', subs: ['盒饭', '粥面类'] },
  { key: 'sushi',    name: '寿司饭团', subs: ['寿司', '饭团'] },
  { key: 'salad',    name: '沙拉轻食', subs: ['沙拉', '菜肴'] },
  { key: 'sandwich', name: '三明治',   subs: [] },
  { key: 'icecream', name: '冰淇淋',   subs: [] },
  { key: 'liquor',   name: '酒品',     subs: [] },
  { key: 'snack',    name: '休闲零食', subs: ['糖', '薯片', '巧克力', '饼干', '果冻'] },
  { key: 'drink',    name: '水饮饮料', subs: ['茶饮', '饮用水', '饮料', '乳制品'] },
  { key: 'case',     name: '整箱好物', subs: [] },
  { key: 'fastfood', name: '方便速食', subs: [] }
];

const categories = ref(defaultCats);
const allProducts = ref([]);
const activeCat = ref('bakery');
const activeSub = ref('全部');
const cart = ref({});
const loaded = ref(false);
const searching = ref(false);
const keyword = ref('');

const store = useUserStore();

onMounted(async () => {
  initCloudBase();
  try { await store.fetchMe(); } catch (e) {}
  await loadCats();
  await loadProducts();
});

async function loadCats() {
  try {
    const catRes = await api.groceryCatList();
    categories.value = catRes?.items || [];
  } catch (e) { categories.value = defaultCats; }
}

async function loadProducts() {
  try {
    const res = await api.groceryProductList({});
    const items = res?.items || [];
    const cats = categories.value;
    items.forEach(p => {
      const cat = cats.find(c => c.key === p.category);
      if (cat) p.categoryName = cat.name;
    });
    allProducts.value = items;
    const fileIds = items.filter(p => p.imageFileId).map(p => p.imageFileId);
    if (fileIds.length > 0) {
      try {
        const urlRes = await wx.cloud.getTempFileURL({ fileList: fileIds });
        const map = {};
        (urlRes.fileList || []).forEach(f => { if (f.tempFileURL) map[f.fileID] = f.tempFileURL; });
        items.forEach(p => { if (map[p.imageFileId]) p._img = map[p.imageFileId]; });
      } catch (e) {}
    }
    allProducts.value = [...items];
  } catch (e) { allProducts.value = []; }
  loaded.value = true;
}

const activeSubcats = computed(() => {
  const cat = categories.value.find(c => c.key === activeCat.value);
  return cat ? ['全部', ...(cat.subs || [])] : ['全部'];
});

const filteredProducts = computed(() => {
  let list = allProducts.value;
  if (keyword.value) {
    const kw = keyword.value;
    list = list.filter(p => String(p.name || '').includes(kw));
  } else {
    list = list.filter(p => p.category === activeCat.value);
    if (activeSub.value !== '全部') list = list.filter(p => p.sub === activeSub.value);
  }
  return list;
});

const totalCount = computed(() => Object.values(cart.value).reduce((a, b) => a + b, 0));
const totalAmount = computed(() => {
  let sum = 0;
  for (const p of allProducts.value) {
    const qty = cart.value[p._id] || 0;
    sum += qty * Number(p.price || 0);
  }
  return sum;
});

function incQty(p) { cart.value[p._id] = (cart.value[p._id] || 0) + 1; }
function decQty(p) {
  cart.value[p._id] = Math.max(0, (cart.value[p._id] || 0) - 1);
  if (cart.value[p._id] <= 0) delete cart.value[p._id];
}

function goPublish() {
  if (totalCount.value === 0) return;
  const items = allProducts.value.filter(p => cart.value[p._id]).map(p => p.name + ' x' + cart.value[p._id]);
  uni.navigateTo({ url: '/pages/task-publish/index?type=grocery&items=' + encodeURIComponent(items.join('\n')) });
}

function onSearchClick() { searching.value = true; }
function closeSearch() { if (!keyword.value) searching.value = false; }

watch(activeCat, () => { activeSub.value = '全部'; });
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: #fff; }
.search-bar { display: flex; align-items: center; padding: 16rpx 24rpx; background: #fff; border-bottom: 1rpx solid #F0F0F0; }
.search-input { flex: 1; display: flex; align-items: center; height: 64rpx; background: #F5F6F8; border-radius: 32rpx; padding: 0 20rpx; }
.search-icon { font-size: 26rpx; color: #999; margin-right: 10rpx; }
.search-placeholder { font-size: 26rpx; color: #B0B0B0; }
.search-real { flex: 1; font-size: 26rpx; color: #2A4257; }

.body { flex: 1; display: flex; min-height: 0; padding-bottom: 140rpx; }
.cat-list { width: 170rpx; background: #F5F6F8; height: 100%; }
.cat-item { display: flex; align-items: center; justify-content: center; padding: 28rpx 8rpx; position: relative; }
.cat-item.active { background: #fff; }
.cat-item.active::before { content: ''; position: absolute; left: 0; top: 24rpx; bottom: 24rpx; width: 6rpx; background: #3E9BF0; border-radius: 0 4rpx 4rpx 0; }
.cat-name { font-size: 26rpx; color: #5A7A92; text-align: center; }
.cat-item.active .cat-name { color: #3E9BF0; font-weight: 600; }

.product-list { flex: 1; background: #fff; height: 100%; overflow-y: auto; }
.product-subtabs { display: flex; align-items: center; gap: 20rpx; padding: 20rpx 24rpx; border-bottom: 1rpx solid #F0F0F0; flex-wrap: wrap; }
.subtab { font-size: 26rpx; color: #5A7A92; padding: 6rpx 18rpx; border-radius: 20rpx; background: #F5F6F8; }
.subtab.active { font-weight: 600; color: #fff; background: #3E9BF0; }

.empty-products { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #B0B0B0; }

.product-list-vertical { display: flex; flex-direction: column; gap: 16rpx; padding: 16rpx 24rpx; }
.p-row { display: flex; align-items: center; gap: 20rpx; background: #fff; border-radius: 14rpx; padding: 16rpx; border: 1rpx solid #F0F0F0; height: 192rpx; box-sizing: border-box; }
.p-img { width: 160rpx; height: 160rpx; border-radius: 12rpx; flex-shrink: 0; background: #F5F6F8; }
.p-img-placeholder { width: 160rpx; height: 160rpx; border-radius: 12rpx; flex-shrink: 0; background: #F5F6F8; display: flex; align-items: center; justify-content: center; }
.ph-text { font-size: 22rpx; color: #B0B0B0; }
.p-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16rpx; overflow: hidden; justify-content: center; }
.p-name { font-size: 28rpx; color: #2A4257; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-all; }
.p-price { font-size: 32rpx; font-weight: 700; color: #FF7043; }
.p-action { flex-shrink: 0; }
.add-btn { width: 56rpx; height: 56rpx; background: #3E9BF0; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40rpx; line-height: 56rpx; text-align: center; }
.qty-control { display: flex; align-items: center; gap: 16rpx; }
.qty-btn { width: 48rpx; height: 48rpx; background: #E3F1FD; color: #3E9BF0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36rpx; line-height: 48rpx; text-align: center; font-weight: 600; }
.qty-num { font-size: 30rpx; color: #2A4257; min-width: 36rpx; text-align: center; font-weight: 600; }

.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 100; display: flex; align-items: center; gap: 20rpx; padding: 20rpx 28rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); background: #fff; border-top: 1rpx solid #F0F0F0; box-sizing: border-box; }
.bb-info { flex: 1; min-width: 0; }
.bb-amount { font-size: 36rpx; font-weight: 700; color: #333; line-height: 1.2; }
.bb-count { font-size: 22rpx; color: #8AA3B8; display: block; margin-top: 4rpx; }
.bb-btn { flex-shrink: 0; background: #E0E0E0; color: #999; padding: 18rpx 40rpx; border-radius: 40rpx; font-size: 28rpx; }
.bb-btn.active { background: #3E9BF0; color: #fff; }
</style>