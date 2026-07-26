<template>
  <view class="page">
    <view class="title">管理中心</view>
    <view v-if="loading" class="empty">身份加载中…</view>
    <view v-else-if="errorMessage" class="error-state"><view>{{ errorMessage }}</view><button class="retry" @click="loadIdentity">重新加载</button></view>
    <template v-else>
      <navigator class="menu-button" url="/pages-super/rule-management/index" hover-class="menu-button-active">规则管理</navigator>
      <navigator class="menu-button" url="/pages-super/account-management/index" hover-class="menu-button-active">账号管理</navigator>
      <navigator class="menu-button" url="/pages-super/admin-management/index" hover-class="menu-button-active">管理员管理</navigator>
      <navigator class="menu-button" url="/pages-super/acceptance-stats/index" hover-class="menu-button-active">接单率统计</navigator>
      <navigator class="menu-button" url="/pages-super/announcement-management/index" hover-class="menu-button-active">公告管理</navigator>
      <navigator class="menu-button" url="/pages-super/merchant-review/index" hover-class="menu-button-active">商家审核</navigator>
      <navigator class="menu-button" url="/pages-super/audit-logs/index" hover-class="menu-button-active">操作记录</navigator>
      <button class="btn danger logout-button" @click="confirmLogout">退出登录</button>
    </template>
  </view>
</template>
<script setup>
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { useUserStore } from '../../stores/user';
import { syncRoleSurface } from '../../utils/roleNavigation';
import { safeReLaunch } from '../../utils/navigation';
const store=useUserStore();const loading=ref(false);const errorMessage=ref('');
async function loadIdentity(){loading.value=true;errorMessage.value='';try{await syncRoleSurface(store,'SUPER')}catch(error){console.error('dashboard auth failed',{action:'user.me',page:'SUPER_ADMIN管理中心',code:error?.code,message:error?.message});errorMessage.value=error?.message||'身份加载失败，请稍后重试'}finally{loading.value=false}}
function confirmLogout(){uni.showModal({title:'退出登录',content:'确认退出当前账号？',success:({confirm})=>{if(!confirm)return;store.clearSession();safeReLaunch('/pages/login/index')}})}
onShow(loadIdentity);
</script>
<style scoped>.menu-button{width:100%;height:92rpx;display:flex;align-items:center;justify-content:center;box-sizing:border-box;margin:14rpx 0;border-radius:6px;background:#EAF4FD;color:#2E8FD9;font-size:30rpx}.menu-button-active{background:#dcece7}.logout-button{margin-top:28rpx}.error-state{text-align:center;color:#b42318;padding:70rpx 0}.retry{width:220rpx;margin-top:20rpx;font-size:26rpx}</style>
