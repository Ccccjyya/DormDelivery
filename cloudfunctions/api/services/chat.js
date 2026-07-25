const { ok, fail } = require('../common/response');
const PAGE_SIZE = 50;

function cleanText(value, field, max) {
  const text = String(value || '').trim();
  if (!text) throw fail('VALIDATION_ERROR', '请输入' + field);
  if (text.length > max) throw fail('VALIDATION_ERROR', field + '过长');
  return text;
}

async function send({ db, openid, data }) {
  const orderId = cleanText(data.orderId, '订单ID', 64);
  const order = (await db.collection('orders').doc(orderId).get()).data;
  if (!order) throw fail('ORDER_NOT_FOUND', '订单不存在');

  const isPublisher = order.publisherOpenid === openid;
  const isReceiver = order.receiverOpenid === openid;
  if (!isPublisher && !isReceiver) throw fail('FORBIDDEN', '无权发送消息');
  if (order.status === 'WAITING' || order.withdrawn || order.status === 'EXPIRED')
    throw fail('ORDER_UNAVAILABLE', '订单状态不支持聊天');

  const receiverId = isPublisher ? order.receiverId : order.publisherId;
  const receiverOpenid = isPublisher ? order.receiverOpenid : order.publisherOpenid;
  const sender = await getUser(db, openid);

  const type = data.type === 'image' ? 'image' : 'text';
  let content = '';
  let fileId = '';

  if (type === 'text') {
    content = cleanText(data.content, '消息', 500);
  } else if (type === 'image') {
    fileId = cleanText(data.fileId, '图片ID', 200);
  }

  const msg = {
    orderId,
    senderId: sender._id,
    senderOpenid: openid,
    receiverId,
    receiverOpenid,
    type,
    content,
    fileId,
    createdAt: new Date(),
    readAt: null
  };

  await db.collection('chats').add({ data: msg });
  return ok({ messageId: msg._id || 'sent' });
}

async function list({ db, openid, data }) {
  const orderId = cleanText(data.orderId, '订单ID', 64);
  const order = (await db.collection('orders').doc(orderId).get()).data;
  if (!order) throw fail('ORDER_NOT_FOUND', '订单不存在');

  const isParticipant = order.publisherOpenid === openid || order.receiverOpenid === openid;
  if (!isParticipant) throw fail('FORBIDDEN', '无权查看消息');

  const lastId = data.lastId || null;

  // 先标记未读消息为已读，再查询（使已读状态即时生效）
  const now = new Date();
  try {
    const unreadQuery = await db.collection('chats').where({ orderId, senderOpenid: db.command.neq(openid), readAt: null }).get();
    if (unreadQuery.data.length > 0) {
      await db.collection('chats').where({ _id: db.command.in(unreadQuery.data.map(m => m._id)) }).update({ data: { readAt: now } });
    }
  } catch (e) {}

  let query = db.collection('chats').where({ orderId }).orderBy('createdAt', 'asc').limit(PAGE_SIZE);
  if (lastId) {
    const lastMsg = (await db.collection('chats').doc(lastId).get()).data;
    if (lastMsg) query = query.where({ createdAt: db.command.gt(lastMsg.createdAt) });
  }
  const result = await query.get();
  const items = result.data.map(m => {
    const isMine = m.senderOpenid === openid;
    const isRead = isMine ? (m.readAt ? true : false) : true;
    return {
      id: m._id, senderId: m.senderId, type: m.type, content: m.content,
      fileId: m.fileId, createdAt: m.createdAt, isMine, isRead, readAt: m.readAt || null
    };
  });

  return ok({ items });
}

async function getUser(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

async function conversations({ db, openid }) {
  const me = await getUser(db, openid);
  if (!me) return ok({ items: [] });

  // 找到我参与的所有订单（发布或接收）
  const myOrders = await db.collection('orders').where(db.command.or([
    { publisherOpenid: openid },
    { receiverOpenid: openid }
  ])).get();

  const orderIds = myOrders.data.map(o => o._id);
  if (orderIds.length === 0) return ok({ items: [] });

  // 拉取所有聊天消息
  const chats = await db.collection('chats').where({ orderId: db.command.in(orderIds) }).orderBy('createdAt', 'asc').get();

  // 按订单聚合最新消息 + 未读数
  const grouped = new Map();
  for (const m of chats.data) {
    const cur = grouped.get(m.orderId) || { messages: [], unread: 0, latest: null };
    cur.messages.push(m);
    if (!m.readAt && m.senderOpenid !== openid) cur.unread += 1;
    if (!cur.latest || new Date(m.createdAt) > new Date(cur.latest.createdAt)) cur.latest = m;
    grouped.set(m.orderId, cur);
  }

  // 构建会话列表
  const items = [];
  for (const orderId of orderIds) {
    const g = grouped.get(orderId);
    if (!g || !g.latest) continue;
    const order = myOrders.data.find(o => o._id === orderId);
    if (!order || order.withdrawn || order.status === 'WAITING' || order.status === 'EXPIRED') continue;
    const peerId = order.publisherOpenid === openid ? order.receiverId : order.publisherId;
    const peerName = order.publisherOpenid === openid ? (order.receiverSnapshot?.displayName || '同学') : (order.publisherSnapshot?.displayName || '同学');
    items.push({
      id: orderId,
      orderId,
      peerName,
      orderTitle: order.orderDetail || order.itemName,
      latestMessage: g.latest.type === 'image' ? '[图片]' : g.latest.content,
      latestTime: g.latest.createdAt,
      unread: g.unread,
      isMineLatest: g.latest.senderOpenid === openid
    });
  }

  // 按最新消息时间倒序
  items.sort((a, b) => new Date(b.latestTime) - new Date(a.latestTime));
  return ok({ items });
}

module.exports = { send, list, conversations };
