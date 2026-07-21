import { safeReLaunch } from './navigation';

export function routeForProfile(profile) {
  if (profile?.role === 'SUPER_ADMIN') return '/pages-super/dashboard/index';
  if (!profile?.profileCompleted) return '/pages/register/index';
  return '/pages/home/index';
}

export async function syncRoleSurface(store, surface) {
  const profile = await store.fetchMe();
  const allowed = surface === 'SUPER'
    ? profile.role === 'SUPER_ADMIN'
    : surface === 'ADMIN'
      ? profile.role === 'ADMIN'
      : profile.role === 'USER' || profile.role === 'ADMIN';
  if (!allowed) {
    await safeReLaunch(routeForProfile(profile));
    return { allowed: false, profile };
  }
  return { allowed: true, profile };
}
