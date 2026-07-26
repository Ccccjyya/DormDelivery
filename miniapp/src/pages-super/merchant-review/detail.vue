<template>
  <view class="page" v-if="app">
    <view class="title">申请详情</view>
    <view class="card">
      <view class="row"><text class="label">商家名称</text><text class="val">{{ app.storeName }}</text></view>
      <view class="row"><text class="label">联系人</text><text class="val">{{ app.contactName }}</text></view>
      <view class="row"><text class="label">手机号</text><text class="val">{{ app.phone }}</text></view>
      <view class="row"><text class="label">位置</text><text class="val">{{ app.storeAddress }}</text></view>
      <view class="row" v-if="app.description">
        <text class="label">说明</text><text class="val">{{ app.description }}</text>
      </view>
      <view v-if="app.certImages && app.certImages.length" class="img-section">
        <text class="label">资质图片</text>
        <view class="img-grid">
          <image v-for="url in app.certImages" :key="url" :src="url" class="cert-img" mode="aspectFill" @click="preview(url)" />
        </view>
      </view>
    </view>

    <view class="actions" v-if="app.status === 'PENDING'">
      <button class="btn approve" @click="review('APPROVED')">通过审核</button>
      <button class="btn reject" @click="review('REJECTED')">拒绝</button>
    </view>
    <view v-else class="result-msg">审核结果：{{ app.status === 'APPROVED' ? '已通过' : '已拒绝' }}</view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../utils/request';
import { syncRoleSurface } from '../../utils/roleNavigation';
import { useUserStore } from '../../stores/user';

const store = useUserStore();
const id = ref('');
const app = ref(null);

onLoad((q) => { id.value = q.id; });
onMounted(async () => { await syncRoleSurface(store, 'SUPER'); loadDetail(); });

async function loadDetail() {
  try {
    const res = await api.superMerchantApplicationDetail({ id: id.value });
    app.value = res;
  } catch (e) { uni.showToast({ title: '加载失败', icon: 'none' }); }
}

async function review(status) {
  uni.showModal({
    title: status === 'APPROVED' ? '确认通过' : '确认拒绝',
    content: status === 'APPROVED' ? '该商家将获得MERCHANT角色权限' : '拒绝后将不会通知商家，可后续再次审核',
    success: async ({ confirm }) => {
      if (!confirm) return;
      try {
        await api.superMerchantReview({ id: id.value, status });
        uni.showToast({ title: '操作成功', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 800);
      } catch (e) { uni.showToast({ title: '操作失败', icon: 'none' }); }
    }
  });
}

function preview(url) { wx.previewImage({ current: url, urls: app.value.certImages }); }
</script>

<style scoped>
.page { min-height: 100vh; background: #F3F8FD; padding: 20rpx 32rpx; }
.title { font-size: 34rpx; font-weight: 700; color: #2A4257; margin-bottom: 20rpx; }
.card { background: #fff; border-radius: 14rpx; padding: 28rpx; margin-bottom: 24rpx; }
.row { margin-bottom: 20rpx; }
.label { font-size: 24rpx; color: #8AA3B8; display: block; margin-bottom: 4rpx; }
.val { font-size: 28rpx; color: #2A4257; }
.img-section { margin-top: 8rpx; }
.img-grid { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 12rpx; }
.cert-img { width: 200rpx; height: 200rpx; border-radius: 10rpx; background: #F5F6F8; }
.actions { display: flex; gap: 20rpx; }
.btn { flex: 1; height: 88rpx; border-radius: 14rpx; font-size: 28rpx; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.btn.approve { background: #2A9955; color: #fff; }
.btn.reject { background: #E57373; color: #fff; }
.result-msg { text-align: center; padding: 60rpx; font-size: 28rpx; color: #8AA3B8; }
</style>
