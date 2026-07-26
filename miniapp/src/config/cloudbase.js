export const CLOUDBASE_ENV_ID = 'cloud1-placeholder00000000';
export const CLOUD_API_FUNCTION = 'api';

export function initCloudBase() {
  if (typeof wx === 'undefined' || !wx.cloud) return;
  wx.cloud.init({ env: CLOUDBASE_ENV_ID, traceUser: true });
}
