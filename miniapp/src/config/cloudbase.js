export const CLOUDBASE_ENV_ID = 'cloud1-d5g3fo6t28ba733e2';
export const CLOUD_API_FUNCTION = 'api';

export function initCloudBase() {
  if (typeof wx === 'undefined' || !wx.cloud) return;
  wx.cloud.init({ env: CLOUDBASE_ENV_ID, traceUser: true });
}
