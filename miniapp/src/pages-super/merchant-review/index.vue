<template>
  <view class="page">
    <view class="title">商家审核</view>

    <view class="tab-bar">
      <view class="tb-item" :class="{ active: activeTab === 'pending' }" @click="activeTab='pending'">待审核</view>
      <view class="tb-item" :class="{ active: activeTab === 'done' }" @click="activeTab='done'">已审核</view>
    </view>


    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="list.length === 0" class="empty">暂无记录</view>
    <view v-else v-for="item in list" :key="item._id" class="app-card" @click="goDetail(item._id)">
      <view class="ac-row1">
        <text class="ac-name">{{ item.storeName }}</text>
        <text class="ac-status" :class="'s-' + item.status">{{ statusLabel[item.status] || item.status }}</text>
      </view>
      <view class="ac-row2">
        <text class="ac-info">联系人：{{ item.contactName }} · {{ item.phone }}</text>
      </view>
      <view class="ac-row3">
        <text class="ac-info">位置：{{ item.storeAddress }}</text>
      </view>
      <view class="ac-row3">
        <text class="ac-time">{{ formatTime(item.createdAt) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { api } from '../../utils/request';
import { syncRoleSurface } from '../../utils/roleNavigation';
import { useUserStore } from '../../stores/user';

const store = useUserStore();
const activeTab = ref('pending');
const loading = ref(false);
const list = ref([]);
const statusLabel = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已拒绝' };

onMounted(async () => { await syncRoleSurface(store, 'SUPER'); loadList(); });

async function loadList() {
  loading.value = true;
  try {
    const res = await api.superMerchantApplications({ status: activeTab.value === 'pending' ? 'PENDING' : undefined });
    let items = res?.items || [];
    if (activeTab.value === 'done') {
      items = items.filter(item => item.status !== 'PENDING');
    }
    list.value = items;
  } catch (e) { list.value = []; }
  loading.value = false;
}

function goDetail(id) { uni.navigateTo({ url: '/pages-super/merchant-review/detail?id=' + id }); }

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  return d.getFullYear() + '-' + (d.getMonth()+1).toString().padStart(2,'0') + '-' + d.getDate().toString().padStart(2,'0') + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

watch(activeTab, loadList);
</script>

<style scoped>
.page { min-height: 100vh; background: #F3F8FD; padding: 20rpx 32rpx; padding-bottom: 100rpx; }
.title { font-size: 36rpx; font-weight: 700; color: #2A4257; margin-bottom: 20rpx; }
.tab-bar { display: flex; background: #E3F1FD; border-radius: 14rpx; padding: 6rpx; margin-bottom: 24rpx; }
.tb-item { flex: 1; text-align: center; padding: 16rpx 0; font-size: 28rpx; color: #5A7A92; border-radius: 10rpx; }
.tb-item.active { background: #fff; color: #3E9BF0; font-weight: 600; }
.empty { text-align: center; padding: 80rpx 0; color: #8AA3B8; font-size: 26rpx; }
.app-card { background: #fff; border-radius: 14rpx; padding: 24rpx; margin-bottom: 16rpx; border: 1rpx solid #E3F1FD; }
.ac-row1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.ac-name { font-size: 30rpx; font-weight: 600; color: #2A4257; }
.ac-status { font-size: 24rpx; padding: 6rpx 16rpx; border-radius: 10rpx; }
.s-PENDING { background: #FDF0D5; color: #B7791F; }
.s-APPROVED { background: #E6F7EC; color: #2A9955; }
.s-REJECTED { background: #f0f0f0; color: #999; }
.ac-row2, .ac-row3 { margin-bottom: 6rpx; }
.ac-info { font-size: 24rpx; color: #8AA3B8; }
.ac-time { font-size: 22rpx; color: #B0B0B0; }
</style>
