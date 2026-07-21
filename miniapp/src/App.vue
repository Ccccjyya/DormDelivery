<template>
  <slot />
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from './stores/user';
import { routeForProfile } from './utils/roleNavigation';
import { currentPageRoute, safeReLaunch } from './utils/navigation';
const store=useUserStore();let syncingRole=false;
onShow(async()=>{
  const initialRoute=currentPageRoute();
  if(syncingRole||!store.profile||!initialRoute||['pages/login/index','pages/register/index'].includes(initialRoute))return;
  syncingRole=true;
  try{
    const profile=await store.fetchMe();
    const route=currentPageRoute();
    const onSuper=route.startsWith('pages-super/');const onAdmin=route.startsWith('pages-admin/');
    const invalid=profile.role==='SUPER_ADMIN'?!onSuper:(onSuper||(profile.role!=='ADMIN'&&onAdmin));
    if(invalid)await safeReLaunch(routeForProfile(profile));
  }catch(error){console.error('app role sync failed',{action:'user.me',page:'App',code:error?.code,message:error?.message})}finally{syncingRole=false}
});
</script>

<style>
page {
  background: #f3f7f6;
  color: #172b27;
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
  border: 1rpx solid #deebe7;
  box-shadow: 0 4rpx 14rpx rgba(15, 72, 61, 0.05);
}
.title {
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: 0;
  margin-bottom: 12rpx;
}
.subtitle {
  color: #6a7d76;
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
  border: 1px solid #cfded9;
  border-radius: 6px;
  background: #fff;
  box-sizing: border-box;
  margin-bottom: 18rpx;
}
.btn {
  background: #147a69;
  color: #fff;
  border-radius: 6px;
  font-size: 30rpx;
  margin: 14rpx 0;
}
.btn.secondary {
  background: #edf5f2;
  color: #1d5b50;
}
.btn.danger {
  background: #dc2626;
}
.btn::after { border: 0; }
.muted {
  color: #6a7d76;
  font-size: 26rpx;
}
.empty {
  text-align: center;
  color: #6a7d76;
  padding: 80rpx 0;
}
.status {
  padding: 6rpx 14rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  color: #0e6658;
  background: #e2f3ed;
}
.status.warning { color: #a05a00; background: #fff1d7; }
.status.done { color: #356a1e; background: #e9f5dc; }
.metric { font-size: 38rpx; font-weight: 700; color: #147a69; }
</style>
