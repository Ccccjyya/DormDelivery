import { defineStore } from 'pinia';
import { api } from '../utils/request';
import { safeReLaunch } from '../utils/navigation';

export const useUserStore = defineStore('user', {
  state: () => ({
    profile: uni.getStorageSync('cloudProfile') || null
  }),
  actions: {
    async loginWithWeChat() {
      const session = await api.wechatLogin();
      this.profile = session.profile;
      uni.setStorageSync('cloudProfile', session.profile);
      return session;
    },
    async fetchMe() {
      this.profile = await api.me();
      uni.setStorageSync('cloudProfile', this.profile);
      return this.profile;
    },
    logout() {
      this.clearSession();
      safeReLaunch('/pages/login/index');
    },
    clearSession() {
      this.profile = null;
      uni.removeStorageSync('cloudProfile');
      uni.removeStorageSync('userRole');
      uni.removeStorageSync('role');
      uni.removeStorageSync('accountDisabledExit');
    }
  }
});
