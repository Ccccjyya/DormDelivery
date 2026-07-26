<template>
  <slot />
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from './stores/user';
import { routeForProfile, resolveUserRoute } from './utils/roleNavigation';
import { currentPageRoute, safeReLaunch } from './utils/navigation';
const store=useUserStore();let syncingRole=false;
onShow(async()=>{
  const initialRoute=currentPageRoute();
  if(syncingRole||!store.profile||!initialRoute||['pages/login/index','pages/register/index'].includes(initialRoute))return;
  syncingRole=true;
  try{
    const profile=await store.fetchMe();
    const route=currentPageRoute();
    const onSuper=route.startsWith('pages-super/');const onAdmin=route.startsWith('pages-admin/');const onMerchant=route.startsWith('pages-merchant/');
    const invalid=profile.role==='SUPER_ADMIN'?!onSuper:(profile.role==='MERCHANT'?!onMerchant:(onSuper||(profile.role!=='ADMIN'&&onAdmin)));
    if(invalid)await safeReLaunch(await resolveUserRoute(profile));
  }catch(error){console.error('app role sync failed',{action:'user.me',page:'App',code:error?.code,message:error?.message})}finally{syncingRole=false}
});
</script>

<style>
page {
  background: #F3F8FD;
  color: #1B3A57;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.page {
  min-height: 100vh;
  padding: 28rpx 24rpx 44rpx;
  box-sizing: border-box;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 26rpx;
  margin-bottom: 22rpx;
  border: 1rpx solid #D8E9F7;
  box-shadow: 0 4rpx 14rpx rgba(46, 143, 217, 0.06);
}
.title {
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: 0;
  margin-bottom: 12rpx;
}
.subtitle {
  color: #7A93A8;
  font-size: 26rpx;
  margin-bottom: 24rpx;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.input {
  width: 100%;
  min-height: 84rpx;
  padding: 0 20rpx;
  border: 1px solid #C9DFF2;
  border-radius: 6px;
  background: #fff;
  box-sizing: border-box;
  margin-bottom: 18rpx;
}
.btn {
  background: #3E9BF0;
  color: #fff;
  border-radius: 6px;
  font-size: 30rpx;
  margin: 14rpx 0;
}
.btn.secondary {
  background: #EAF4FD;
  color: #2E8FD9;
}
.btn.danger {
  background: #dc2626;
}
.btn::after { border: 0; }
.muted {
  color: #7A93A8;
  font-size: 26rpx;
}
.empty {
  text-align: center;
  color: #7A93A8;
  padding: 80rpx 0;
}
.status {
  padding: 6rpx 14rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  color: #2E8FD9;
  background: #E3F1FD;
}
.status.warning { color: #a05a00; background: #fff1d7; }
.status.done { color: #356a1e; background: #e9f5dc; }
.metric { font-size: 38rpx; font-weight: 700; color: #2E8FD9; }
</style>
