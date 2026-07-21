const { ok } = require('../common/response');

async function getBuildings({ db }) {
  const result = await db.collection('dormBuildings')
    .where({ enabled: true })
    .orderBy('buildingNo', 'asc')
    .get();
  return ok(result.data);
}

async function getFloors({ db, data }) {
  const buildingId = data.buildingId;
  const rooms = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const result = await db.collection('dormRooms')
      .where({ buildingId, enabled: true })
      .orderBy('floorNo', 'asc')
      .limit(pageSize)
      .skip(offset)
      .get();
    rooms.push(...result.data);
    if (result.data.length < pageSize) break;
  }
  return ok([...new Set(rooms.map((room) => Number(room.floorNo)).filter(Number.isFinite))].sort((left, right) => left - right));
}

async function getRooms({ db, data }) {
  const buildingId = data.buildingId;
  const floorNo = Number(data.floorNo);
  const result = await db.collection('dormRooms')
    .where({ buildingId, floorNo, enabled: true })
    .orderBy('doorplateNo', 'asc')
    .get();
  return ok(result.data);
}

module.exports = { getBuildings, getFloors, getRooms };
