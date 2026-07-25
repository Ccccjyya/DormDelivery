<template>
  <view class="page admin-order-page">
    <view class="order-header">
      <view class="row">
        <view class="title">订单管理</view>
        <button class="menu-button" @click="goMenu">菜单</button>
      </view>
      <view class="filter-row">
        <text class="filter-label">楼层范围</text>
        <picker :range="floorFilterOptions" range-key="label" :value="selectedFilterIndex" @change="pickFloorFilter">
          <view class="filter-picker">{{ selectedFilterLabel }}</view>
        </picker>
      </view>
    </view>

    <scroll-view class="order-content" scroll-y @scrolltolower="load()">
      <view v-if="errorMessage" class="error-state">{{ errorMessage }}<button class="retry" @click="load(true)">重新加载</button></view>
      <view v-else-if="!items.length && !loading" class="empty">暂无待接订单</view>
      <view v-for="order in items" :key="order.id" class="card" @click="detail(order.id)">
        <view class="row"><strong>{{ order.itemName || '未命名订单' }}</strong><text class="status">{{ order.floorNo }}层</text></view>
        <view class="muted">备注：{{ order.remark || '无' }}</view>
        <view v-if="order.imageUrls?.length" class="image-list">
          <image v-for="url in order.imageUrls" :key="url" class="order-image" :src="url" mode="aspectFill" @click.stop="previewImages(order.imageUrls, url)" />
        </view>
        <view class="muted">{{ formatDateTime(order.createdAt) }} · {{ order.timeLimitMinutes }}分钟</view>
      </view>
      <view v-if="loading" class="empty loading-state">加载中…</view>
      <view v-else-if="items.length && !hasMore" class="end">没有更多了</view>
    </scroll-view>
  </view>
</template>

<script setup>
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { computed, reactive, ref } from 'vue';
import { api } from '../../utils/request';
import { formatDateTime } from '../../utils/orderDisplay';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
import { safeReLaunch } from '../../utils/navigation';

const FILTER_MODES = Object.freeze({ MY_FLOOR: 'MY_FLOOR', SPECIFIC_FLOOR: 'SPECIFIC_FLOOR', ALL_FLOORS: 'ALL_FLOORS' });
const items = ref([]), profile = ref(null), buildingFloors = ref([]), page = ref(0), hasMore = ref(true), loading = ref(false), errorMessage = ref(''), allowedEntry = ref(false);
const filterState = reactive({ filterMode: FILTER_MODES.ALL_FLOORS, selectedFloorNo: null });
const floorFilterOptions = computed(() => [
  { mode: FILTER_MODES.ALL_FLOORS, floorNo: null, label: '全部楼层' },
  { mode: FILTER_MODES.MY_FLOOR, floorNo: null, label: '我的楼层' },
  ...buildingFloors.value.map((floorNo) => ({ mode: FILTER_MODES.SPECIFIC_FLOOR, floorNo, label: `${floorNo} 层` }))
]);
const selectedFilterIndex = computed(() => {
  const index = floorFilterOptions.value.findIndex((option) => option.mode === filterState.filterMode && option.floorNo === filterState.selectedFloorNo);
  return index < 0 ? 0 : index;
});
const selectedFilterLabel = computed(() => floorFilterOptions.value[selectedFilterIndex.value]?.label || '全部楼层');

async function loadContext() {
  profile.value = await api.me();
  buildingFloors.value = profile.value?.dormBuildingId ? await api.floors(profile.value.dormBuildingId) : [];
}
async function load(reset = false) {
  if (loading.value || (!reset && !hasMore.value)) return;
  if (reset) { items.value = []; page.value = 0; hasMore.value = true; }
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await api.adminOrders({ filterMode: filterState.filterMode, selectedFloorNo: filterState.selectedFloorNo, page: page.value });
    const nextItems = await withImageUrls(result.items);
    items.value.push(...nextItems);
    page.value += 1;
    hasMore.value = result.hasMore;
  } catch (error) {
    errorMessage.value = typeof error?.code === 'string' && error?.message ? error.message : '加载失败，请稍后重试';
  } finally { loading.value = false; }
}
async function withImageUrls(orders) {
  const fileIds = [...new Set(orders.flatMap((order) => Array.isArray(order.imageFileIds) ? order.imageFileIds : []))];
  if (!fileIds.length) return orders.map((order) => ({ ...order, imageUrls: [] }));
  const result = await wx.cloud.getTempFileURL({ fileList: fileIds });
  const urlMap = new Map(result.fileList.filter((file) => file.status === 0 && file.tempFileURL).map((file) => [file.fileID, file.tempFileURL]));
  return orders.map((order) => ({ ...order, imageUrls: (order.imageFileIds || []).map((fileId) => urlMap.get(fileId)).filter(Boolean) }));
}
function previewImages(urls, current) { wx.previewImage({ urls, current }); }
function pickFloorFilter(event) {
  const option = floorFilterOptions.value[event.detail.value];
  if (!option) return;
  filterState.filterMode = option.mode;
  filterState.selectedFloorNo = option.floorNo;
  load(true);
}
function detail(id) {
  const value = String(id || '').trim();
  if (!value) return uni.showToast({ title: '订单信息无效', icon: 'none' });
  uni.navigateTo({ url: `/pages-admin/order-detail/index?orderId=${encodeURIComponent(value)}` });
}
function goMenu() {
  const pages = getCurrentPages();
  const previous = pages[pages.length - 2];
  if (previous?.route === 'pages-admin/profile/index') return uni.navigateBack();
  uni.redirectTo({ url: '/pages-admin/profile/index' });
}
onLoad((query) => { allowedEntry.value = query.entry === 'admin-center'; if (!allowedEntry.value) safeReLaunch('/pages/home/index'); });
onShow(async () => { if (!allowedEntry.value) return; try { await loadContext(); await load(true); } catch (error) { errorMessage.value = error?.message || '加载失败，请稍后重试'; } });
onPullDownRefresh(() => runPullDownRefresh(() => allowedEntry.value ? load(true) : undefined));
</script>

<style scoped>
.admin-order-page{height:100vh;display:flex;flex-direction:column;overflow:hidden}.order-header{flex:0 0 auto}.title{margin-bottom:0}.menu-button{width:auto;min-width:112rpx;margin:0;padding:0 24rpx;background:#EAF4FD;color:#2E8FD9;font-size:26rpx;border-radius:6px}.menu-button::after{border:0}.filter-row{display:flex;align-items:center;justify-content:space-between;min-height:84rpx;padding:0 20rpx;margin-bottom:18rpx;border:1rpx solid #D8E9F7;border-radius:6px;background:#fff}.filter-label{color:#7A93A8;font-size:27rpx}.filter-picker{min-width:180rpx;color:#3E9BF0;text-align:right;font-size:27rpx}.order-content{flex:1;min-height:0;box-sizing:border-box}.image-list{display:flex;flex-wrap:wrap;gap:12rpx;margin:12rpx 0}.order-image{width:144rpx;height:144rpx;border-radius:6px}.empty{min-height:100%;display:flex;align-items:center;justify-content:center;padding:0}.loading-state{min-height:120rpx}.error-state{text-align:center;color:#a02b2b;padding:60rpx 0}.retry{width:220rpx;margin-top:20rpx;font-size:26rpx}.end{text-align:center;color:#7A93A8;padding:24rpx}
</style>
