import { safeReLaunch } from './navigation';
import { cloudRequest } from './request';

export function routeForProfile(profile) {
  if (profile?.role === 'SUPER_ADMIN') return '/pages-super/dashboard/index';
  if (profile?.role === 'MERCHANT') return '/pages-merchant/dashboard/index';
  if (!profile?.profileCompleted) return '/pages/register/index';
  return '/pages/tabbar-home/index';
}

export async function resolveUserRoute(profile) {
  // Check for pending merchant application even if role is still USER
  if (!profile || profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN') {
    return routeForProfile(profile);
  }
  if (profile.role === 'MERCHANT') return '/pages-merchant/dashboard/index';
  if (!profile.profileCompleted) return '/pages/register/index';
  // For USER role: check if they submitted a merchant application
  try {
    const app = await cloudRequest('merchant.myApplication', {});
    if (app) return '/pages-merchant/dashboard/index';
  } catch (e) {}
  return '/pages/tabbar-home/index';
}

export async function syncRoleSurface(store, surface) {
  const profile = await store.fetchMe();
  const allowed = surface === 'SUPER'
    ? profile.role === 'SUPER_ADMIN'
    : surface === 'ADMIN'
      ? profile.role === 'ADMIN'
      : surface === 'MERCHANT'
        ? profile.role === 'MERCHANT'
        : surface === 'MERCHANT_OR_SUPER'
          ? (profile.role === 'MERCHANT' || profile.role === 'SUPER_ADMIN')
          : profile.role === 'USER' || profile.role === 'ADMIN';
  if (!allowed) {
    await safeReLaunch(routeForProfile(profile));
    return { allowed: false, profile };
  }
  return { allowed: true, profile };
}
