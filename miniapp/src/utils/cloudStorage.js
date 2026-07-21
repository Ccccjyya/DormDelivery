import { CLOUDBASE_ENV_ID } from '../config/cloudbase';

export async function uploadCloudFile(localFilePath, folder = 'uploads') {
  const extension = localFilePath.split('.').pop() || 'jpg';
  const cloudPath = `${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
  const result = await wx.cloud.uploadFile({ cloudPath, filePath: localFilePath, config: { env: CLOUDBASE_ENV_ID } });
  return { fileID: result.fileID, cloudPath };
}
