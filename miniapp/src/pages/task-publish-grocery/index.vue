<template>
  <view class="page">
    <view class="search-bar">
      <view class="search-input" @click="onSearchClick">
        <text class="search-icon">🔍</text>
        <input v-if="searching" class="search-real" v-model="keyword" focus placeholder="搜索商品" @blur="closeSearch" />
        <text v-else class="search-placeholder">{{ storeName ? '搜索 ' + storeName : '搜索商品' }}</text>
      </view>
    </view>

    <view class="body">
      <scroll-view scroll-y class="cat-list">
        <view
          v-for="cat in categories"
          :key="cat.key"
          class="cat-item"
          :class="{ active: !isSearching && activeCat === cat.key }"
          @click="selectCategory(cat.key)"
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

    <view class="bottom-bar" @click="showCart = true">
      <view class="bb-info">
        <text class="bb-amount">¥{{ totalAmount.toFixed(2) }}</text>
        <text class="bb-count">已选 {{ totalCount }} 件</text>
      </view>
      <text class="bb-btn" @click.stop="totalCount > 0 ? showCart = true : null" :class="{ active: totalCount > 0 }">{{ totalCount > 0 ? '查看购物车' : '未选购商品' }}</text>
    </view>

    <view class="cart-mask" v-if="showCart" @click="showCart = false">
      <view class="cart-panel" @click.stop>
        <view class="cart-title">购物车</view>
        <view v-if="cartItems.length === 0" class="cart-empty">暂无商品</view>
        <view v-else class="cart-list">
          <view v-for="ci in cartItems" :key="ci._id" class="cart-row">
            <image v-if="ci._img" :src="ci._img" class="cart-img" mode="aspectFill" />
            <view v-else class="cart-img-place"></view>
            <view class="cart-info">
              <text class="cart-name">{{ ci.name }}</text>
              <text class="cart-unit">¥{{ ci.price }}</text>
            </view>
            <view class="cart-qty">
              <view class="qty-btn" @click="decQty(ci)">−</view>
              <text class="qty-num">{{ cart[ci._id] }}</text>
              <view class="qty-btn" @click="incQty(ci)">+</view>
            </view>
          </view>
        </view>
        <view class="cart-footer">
          <text class="cart-total">合计 ¥{{ totalAmount.toFixed(2) }}</text>
          <view v-if="totalCount > 0" class="cart-go" @click="goPublishFromCart">去发单</view>
        </view>
      </view>
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
const showCart = ref(false);

const store = useUserStore();

onMounted(async () => {
  initCloudBase();
  try { await store.fetchMe(); } catch (e) {}
  const pages = getCurrentPages();
  const options = pages[pages.length - 1]?.options || {};
  merchantId.value = options.merchantId || '';
  storeName.value = decodeURIComponent(options.storeName || '便利店');
  storeAddress.value = decodeURIComponent(options.storeAddress || '');
  await loadCats();
  await loadProducts();
});

const merchantId = ref('');
const storeName = ref('');
const storeAddress = ref('');

async function loadCats() {
  try {
    const catRes = await api.groceryCatList();
    categories.value = catRes?.items || [];
  } catch (e) { categories.value = defaultCats; }
}

async function loadProducts() {
  try {
    const res = await api.groceryProductList({ merchantId: merchantId.value });
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
  if (keyword.value) {
    return allProducts.value.filter(p => String(p.name || '').includes(keyword.value));
  }
  let list = allProducts.value.filter(p => p.category === activeCat.value);
  if (activeSub.value !== '全部') list = list.filter(p => p.sub === activeSub.value);
  return list;
});

const isSearching = computed(() => Boolean(keyword.value));

function selectCategory(key) {
  keyword.value = '';
  activeCat.value = key;
  activeSub.value = '全部';
}

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
  const sel = allProducts.value.filter(p => cart.value[p._id]);
  const names = {};
  const prices = {};
  const imgs = {};
  sel.forEach(p => { names[p._id] = p.name; prices[p._id] = p.price; imgs[p._id] = p._img || p.imageFileId || ''; });
  uni.setStorageSync('groceryCart', { cart: cart.value, names, prices, imgs, storeName: storeName.value, storeAddress: storeAddress.value, merchantId: merchantId.value });
  uni.navigateTo({ url: '/pages/task-publish/index?type=grocery' });
}
function goPublishFromCart() { showCart.value = false; goPublish(); }

const cartItems = computed(() => allProducts.value.filter(p => cart.value[p._id]));

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

.cart-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 300; display: flex; align-items: flex-end; }
.cart-panel { width: 100%; background: #fff; border-radius: 24rpx 24rpx 0 0; padding: 32rpx; max-height: 65vh; display: flex; flex-direction: column; box-sizing: border-box; }
.cart-title { font-size: 34rpx; font-weight: 700; color: #2A4257; text-align: center; margin-bottom: 20rpx; }
.cart-empty { text-align: center; padding: 60rpx 0; color: #B0B0B0; }
.cart-list { flex: 1; overflow-y: auto; margin-bottom: 20rpx; display: flex; flex-direction: column; gap: 12rpx; }
.cart-row { display: flex; align-items: center; gap: 16rpx; padding: 12rpx 0; border-bottom: 1rpx solid #F0F0F0; }
.cart-img { width: 100rpx; height: 100rpx; border-radius: 10rpx; background: #F5F6F8; flex-shrink: 0; }
.cart-img-place { width: 100rpx; height: 100rpx; border-radius: 10rpx; background: #F5F6F8; flex-shrink: 0; }
.cart-qty { flex-shrink: 0; display: flex; flex-direction: row; align-items: center; gap: 16rpx; }
.cart-info { flex: 1; min-width: 0; }
.cart-name { font-size: 26rpx; color: #2A4257; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.cart-unit { font-size: 26rpx; color: #FF7043; font-weight: 600; margin-top: 6rpx; display: block; }
.cart-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 16rpx; border-top: 1rpx solid #F0F0F0; }
.cart-total { font-size: 32rpx; font-weight: 700; color: #333; }
.cart-go { background: #3E9BF0; color: #fff; padding: 16rpx 40rpx; border-radius: 40rpx; font-size: 28rpx; }
</style>