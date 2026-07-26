const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const res = await db.collection('orders').limit(1000).get();
  const total = res.data.length;
  for (const o of res.data) {
    await db.collection('orders').doc(o._id).remove();
  }
  return { removed: total };
};
