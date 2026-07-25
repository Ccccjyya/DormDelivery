<template>
  <view class="page home-page">
    <view class="home-header">
      <view class="row">
        <view class="title">可接订单</view>
        <button class="btn secondary compact" @click="goProfile">个人中心</button>
      </view>
      <view class="filter-row">
        <text class="filter-label">楼层范围</text>
        <picker :range="floorFilterOptions" range-key="label" :value="selectedFilterIndex" :disabled="!profile?.dormBuildingId" @change="pickFloorFilter">
          <view class="filter-picker">{{ selectedFilterLabel }}</view>
        </picker>
      </view>
    </view>

    <scroll-view class="order-content" scroll-y refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="refreshHome">
      <view v-if="orders.length === 0" class="empty">暂无可接订单</view>
      <view v-for="order in orders" :key="order.id" class="card" @click="detail(order.id)">
        <view class="row"><strong>{{ order.itemName }}</strong><text class="status">{{ order.floorNo }}层</text></view>
        <view class="muted">{{ order.pickupAddress }}</view>
        <view class="muted">{{ formatDateTime(order.createdAt) }} · {{ order.timeLimitMinutes }}分钟</view>
      </view>
    </scroll-view>

    <view class="bottom-action">
      <button class="btn publish-button" :disabled="profile?.publishBlocked" @click="create">{{ profile?.publishBlocked ? '已被禁止发单' : '发布订单' }}</button>
    </view>
  </view>
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app';
import { computed, reactive, ref } from 'vue';
import { api } from '../../utils/request';
import { formatDateTime } from '../../utils/orderDisplay';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
import { useUserStore } from '../../stores/user';
import { syncRoleSurface } from '../../utils/roleNavigation';

const FILTER_MODES = Object.freeze({
  MY_FLOOR: 'MY_FLOOR',
  SPECIFIC_FLOOR: 'SPECIFIC_FLOOR',
  ALL_FLOORS: 'ALL_FLOORS'
});

const orders = ref([]);
const store=useUserStore();
const profile = ref(null);
const buildingFloors = ref([]);
const refreshing = ref(false);
const filterState = reactive({
  filterMode: FILTER_MODES.MY_FLOOR,
  selectedFloorNo: null
});
const floorFilterOptions = computed(() => [
  { mode: FILTER_MODES.MY_FLOOR, floorNo: null, label: '我的楼层' },
  ...buildingFloors.value.map((floorNo) => ({
    mode: FILTER_MODES.SPECIFIC_FLOOR,
    floorNo,
    label: `${floorNo} 层`
  })),
  { mode: FILTER_MODES.ALL_FLOORS, floorNo: null, label: '全部楼层' }
]);
const selectedFilterIndex = computed(() => {
  const index = floorFilterOptions.value.findIndex((option) => (
    option.mode === filterState.filterMode && option.floorNo === filterState.selectedFloorNo
  ));
  return index < 0 ? 0 : index;
});
const selectedFilterLabel = computed(() => floorFilterOptions.value[selectedFilterIndex.value]?.label || '我的楼层');

onShow(async () => {
  const auth=await syncRoleSurface(store,'USER');if(!auth.allowed)return;
  profile.value=auth.profile;
  filterState.filterMode = FILTER_MODES.MY_FLOOR;
  filterState.selectedFloorNo = null;
  await loadFilterContext();
  await load();
});

async function loadFilterContext() {
  try {
    profile.value = await store.fetchMe();
    buildingFloors.value = profile.value.dormBuildingId
      ? await api.floors(profile.value.dormBuildingId)
      : [];
  } catch {
    profile.value = null;
    buildingFloors.value = [];
  }
}

function pickFloorFilter(event) {
  const option = floorFilterOptions.value[event.detail.value];
  if (!option) return;
  filterState.filterMode = option.mode;
  filterState.selectedFloorNo = option.floorNo;
  load();
}

async function load() {
  const result = await api.availableOrders(filterState);
  orders.value = result.items;
}

async function refreshHome() {
  if (refreshing.value) return;
  refreshing.value = true;
  await runPullDownRefresh(async () => {
    await loadFilterContext();
    await load();
  }, () => { refreshing.value = false; });
}

function detail(id) { uni.navigateTo({ url: `/pages/order-detail/index?id=${id}` }); }
function create() { if (profile.value?.publishBlocked) return uni.showToast({ title: '已被禁止发单', icon: 'none' }); uni.navigateTo({ url: '/pages/order-create/index' }); }
function goProfile() { uni.navigateTo({ url: '/pages/profile/index' }); }
</script>

<style scoped>
.home-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}
.home-header { flex: 0 0 auto; }
.title { margin-bottom: 0; }
.compact { width: auto; min-width: 170rpx; margin: 0; font-size: 26rpx; }
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 84rpx;
  padding: 0 20rpx;
  margin-bottom: 18rpx;
  border: 1rpx solid #D8E9F7;
  border-radius: 6px;
  background: #fff;
}
.filter-label { color: #7A93A8; font-size: 27rpx; }
.filter-picker { min-width: 180rpx; color: #3E9BF0; text-align: right; font-size: 27rpx; }
.order-content { flex: 1; min-height: 0; box-sizing: border-box; padding-bottom: 156rpx; }
.empty { min-height: 100%; display: flex; align-items: center; justify-content: center; padding: 0; }
.bottom-action { flex: 0 0 auto; padding-top: 14rpx; background: #F3F8FD; }
.publish-button { margin: 0; }
</style>
