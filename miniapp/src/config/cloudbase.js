export const CLOUDBASE_ENV_ID = 'YOUR_CLOUDBASE_ENV_ID';
export const CLOUD_API_FUNCTION = 'api';

export function initCloudBase() {
  if (typeof wx === 'undefined' || !wx.cloud) return;
  wx.cloud.init({ env: CLOUDBASE_ENV_ID, traceUser: true });
}
