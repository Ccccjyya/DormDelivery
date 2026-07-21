const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const API_FUNCTION = process.env.MAINTENANCE_API_FUNCTION || 'api';
const BATCH_LIMIT = 20;
const MAX_BATCHES = 100;

exports.main = async () => {
  const startedAt = new Date();
  let offset = 0;
  const summary = { scanned: 0, settled: 0, skipped: 0, failed: 0, batches: 0, errors: [] };
  for (let index = 0; index < MAX_BATCHES; index += 1) {
    const response = await cloud.callFunction({ name: API_FUNCTION, data: {
      action: 'maintenance.runWeeklyBatch', source: 'weeklyQuotaMaintenance', data: { limit: BATCH_LIMIT, offset }
    } });
    const result = response.result;
    if (!result || result.code !== 0) throw new Error(result?.message || 'weekly maintenance api returned an error');
    const batch = result.data;
    summary.scanned += Number(batch.scanned || 0);
    summary.settled += Number(batch.settled || 0);
    summary.skipped += Number(batch.skipped || 0);
    summary.failed += Number(batch.failed || 0);
    summary.errors.push(...(batch.errors || []));
    summary.batches += 1;
    offset = Number(batch.nextOffset || offset + BATCH_LIMIT);
    if (!batch.hasMore) break;
  }
  const finishedAt = new Date();
  const output = { ok: summary.failed === 0, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), ...summary };
  console.log('weekly quota maintenance completed', output);
  return output;
};
