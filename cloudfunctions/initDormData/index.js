const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const READ_BATCH_SIZE = 100;
const WRITE_BATCH_SIZE = 20;

function createDormData() {
  const buildings = [];
  const rooms = [];
  for (let buildingNo = 1; buildingNo <= 14; buildingNo += 1) {
    const buildingId = `B${String(buildingNo).padStart(2, '0')}`;
    buildings.push({ buildingId, buildingNo, buildingName: `${buildingNo}号楼`, enabled: true });
    for (let floorNo = 1; floorNo <= 11; floorNo += 1) {
      for (let doorplateNo = 1; doorplateNo <= 30; doorplateNo += 1) {
        const roomNo = String(doorplateNo).padStart(2, '0');
        rooms.push({
          roomId: `${buildingId}-F${String(floorNo).padStart(2, '0')}-R${roomNo}`,
          buildingId,
          buildingNo,
          floorNo,
          doorplateNo,
          roomNo,
          enabled: true
        });
      }
    }
  }
  return { buildings, rooms };
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function deleteCollection(collectionName) {
  const collection = db.collection(collectionName);
  let deleted = 0;
  while (true) {
    const result = await collection.limit(READ_BATCH_SIZE).get();
    if (!result.data.length) return deleted;
    for (const batch of chunks(result.data, WRITE_BATCH_SIZE)) {
      await Promise.all(batch.map((document) => collection.doc(document._id).remove()));
      deleted += batch.length;
    }
  }
}

async function insertCollection(collectionName, records) {
  const collection = db.collection(collectionName);
  let created = 0;
  for (const batch of chunks(records, WRITE_BATCH_SIZE)) {
    await Promise.all(batch.map((record) => collection.add({
      data: { ...record, createdAt: db.serverDate(), updatedAt: db.serverDate() }
    })));
    created += batch.length;
  }
  return created;
}

async function collectionCount(collectionName) {
  const result = await db.collection(collectionName).count();
  return result.total;
}

exports.main = async (event = {}) => {
  if (event.confirmReset !== true) {
    return { code: 'CONFIRMATION_REQUIRED', message: '必须传入 confirmReset: true', data: null };
  }
  if (!process.env.DORM_SEED_TOKEN || event.seedToken !== process.env.DORM_SEED_TOKEN) {
    return { code: 'FORBIDDEN', message: '初始化令牌无效', data: null };
  }

  const result = { buildingsDeleted: 0, roomsDeleted: 0, buildingsCreated: 0, roomsCreated: 0 };
  try {
    result.roomsDeleted = await deleteCollection('dormRooms');
    result.buildingsDeleted = await deleteCollection('dormBuildings');

    const { buildings, rooms } = createDormData();
    result.buildingsCreated = await insertCollection('dormBuildings', buildings);
    result.roomsCreated = await insertCollection('dormRooms', rooms);

    const [buildingTotal, roomTotal] = await Promise.all([
      collectionCount('dormBuildings'),
      collectionCount('dormRooms')
    ]);
    if (buildingTotal !== buildings.length || roomTotal !== rooms.length) {
      throw new Error(`初始化数量校验失败: dormBuildings=${buildingTotal}, dormRooms=${roomTotal}`);
    }
    return { code: 0, message: 'success', data: { success: true, ...result } };
  } catch (error) {
    console.error('reset dorm data failed', error);
    return { code: 'DORM_RESET_FAILED', message: error.message || '宿舍基础数据重置失败', data: result };
  }
};
