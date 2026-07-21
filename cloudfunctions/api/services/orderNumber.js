const MAX_ORDER_NUMBER_ATTEMPTS = 3;

function generateOrderNo(now = Date.now, random = Math.random) {
  return `DD${now()}${random().toString(36).slice(2, 7).toUpperCase()}`;
}

function errorText(error) {
  const parts = [error?.code, error?.errCode, error?.message, error?.errMsg];
  try { parts.push(JSON.stringify(error)); } catch (_) {}
  return parts.filter((value) => value !== undefined && value !== null).join(' ').toLowerCase();
}

function isDuplicateWriteError(error) {
  const text = errorText(error);
  return text.includes('database_duplicate_write')
    || text.includes('duplicate key')
    || text.includes('e11000')
    || /(^|\D)11000(\D|$)/.test(text)
    || text.includes('index key duplicate');
}

async function createWithOrderNoRetry({ attemptCreate, findExisting, generate = generateOrderNo, maxAttempts = MAX_ORDER_NUMBER_ATTEMPTS }) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const orderNo = generate();
    try {
      return await attemptCreate(orderNo, attempt);
    } catch (error) {
      if (!isDuplicateWriteError(error)) throw error;
      const existing = await findExisting();
      if (existing) return existing;
      if (attempt === maxAttempts) {
        const exhausted = new Error('订单编号生成失败，请稍后重试');
        exhausted.code = 'ORDER_NO_GENERATION_FAILED';
        throw exhausted;
      }
    }
  }
  throw new Error('unreachable');
}

async function auditOrderNumbers(db, options = {}) {
  const pageSize = 100;
  const maxDocuments = Math.min(10000, Math.max(pageSize, Number(options.maxDocuments) || 10000));
  const orderNumbers = new Map();
  const requestKeys = new Map();
  const missing = [];
  const blank = [];
  let scanned = 0;
  for (let offset = 0; offset < maxDocuments; offset += pageSize) {
    const result = await db.collection('orders').orderBy('_id', 'asc').skip(offset).limit(pageSize).get();
    for (const order of result.data) {
      scanned += 1;
      if (order.orderNo === undefined || order.orderNo === null) missing.push(order._id);
      else if (!String(order.orderNo).trim()) blank.push(order._id);
      else {
        const orderNo = String(order.orderNo).trim();
        if (!orderNumbers.has(orderNo)) orderNumbers.set(orderNo, []);
        orderNumbers.get(orderNo).push(order._id);
      }
      if (order.publisherId && order.clientRequestId) {
        const key = `${order.publisherId}\u0000${order.clientRequestId}`;
        if (!requestKeys.has(key)) requestKeys.set(key, []);
        requestKeys.get(key).push(order._id);
      }
    }
    if (result.data.length < pageSize) break;
  }
  const duplicates = [...orderNumbers.entries()].filter(([, orderIds]) => orderIds.length > 1).map(([orderNo, orderIds]) => ({ orderNo, orderIds }));
  const duplicateRequests = [...requestKeys.entries()].filter(([, orderIds]) => orderIds.length > 1).map(([key, orderIds]) => {
    const [publisherId, clientRequestId] = key.split('\u0000');
    return { publisherId, clientRequestId, orderIds };
  });
  return {
    scanned,
    truncated: scanned >= maxDocuments,
    missing,
    blank,
    duplicates,
    duplicateRequests,
    readyForUniqueIndexes: missing.length === 0 && blank.length === 0 && duplicates.length === 0 && duplicateRequests.length === 0
  };
}

module.exports = {
  MAX_ORDER_NUMBER_ATTEMPTS,
  generateOrderNo,
  isDuplicateWriteError,
  createWithOrderNoRetry,
  auditOrderNumbers
};
