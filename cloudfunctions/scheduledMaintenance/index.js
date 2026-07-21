const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
cloud.database();

const API_FUNCTION = process.env.MAINTENANCE_API_FUNCTION || 'api';
const BATCH_LIMIT = 20;
const MAX_BATCHES = 5;

function emptyExpiration() {
  return { scanned: 0, expired: 0, skipped: 0, failed: 0, hasMore: false, failedOrders: [] };
}

function emptySettlement() {
  return { scanned: 0, settled: 0, skipped: 0, failed: 0, hasMore: false, failedOrders: [] };
}

function merge(target, current, successKey) {
  target.scanned += Number(current.scanned || 0);
  target[successKey] += Number(current[successKey] || 0);
  target.skipped += Number(current.skipped || 0);
  target.failed += Number(current.failed || 0);
  target.hasMore = current.hasMore === true;
  target.failedOrders.push(...(Array.isArray(current.failedOrders) ? current.failedOrders : []));
}

exports.main = async () => {
  const startedAt = new Date();
  const orderExpiration = emptyExpiration();
  const rewardSettlement = emptySettlement();
  let batches = 0;
  console.log('scheduled maintenance started', { startedAt: startedAt.toISOString(), batchLimit: BATCH_LIMIT, maxBatches: MAX_BATCHES });
  try {
    for (let index = 0; index < MAX_BATCHES; index += 1) {
      const response = await cloud.callFunction({
        name: API_FUNCTION,
        data: { action: 'maintenance.runBatch', source: 'scheduledMaintenance', data: { limit: BATCH_LIMIT } }
      });
      const result = response.result;
      if (!result || result.code !== 0) throw new Error(result?.message || 'maintenance api returned an error');
      merge(orderExpiration, result.data.orderExpiration || {}, 'expired');
      merge(rewardSettlement, result.data.rewardSettlement || {}, 'settled');
      batches += 1;
      console.log('scheduled maintenance batch completed', {
        batch: batches,
        orderExpiration: result.data.orderExpiration,
        rewardSettlement: result.data.rewardSettlement
      });
      if (!result.data.orderExpiration?.hasMore && !result.data.rewardSettlement?.hasMore) break;
    }
    const finishedAt = new Date();
    const output = {
      ok: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      batches,
      orderExpiration,
      rewardSettlement
    };
    console.log('scheduled maintenance completed', output);
    return output;
  } catch (error) {
    const finishedAt = new Date();
    console.error('scheduled maintenance failed', {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      batches,
      message: String(error?.message || error).slice(0, 200),
      orderExpiration,
      rewardSettlement
    });
    throw error;
  }
};
