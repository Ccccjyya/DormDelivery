const { assertActive } = require('../common/permissions');
const { ok, fail } = require('../common/response');
const { toClientUser, assertProfileInput, assertUnlocked } = require('../common/users');

async function me({ user }) {
  assertActive(user);
  return ok(toClientUser(user));
}

async function completeProfile({ db, user, data }) {
  assertActive(user);
  if (user.role === 'ADMIN' && user.profileCompleted && user.dormBuildingId && user.dormBuildingId !== data.dormBuildingId) {
    throw fail('ADMIN_BUILDING_LOCKED', '管理员不能直接修改宿舍楼，请先由超级管理员取消管理员身份');
  }
  assertProfileInput(data);
  assertUnlocked(user, 'realName', data.realName);
  assertUnlocked(user, 'studentNo', data.studentNo);
  assertUnlocked(user, 'dormBuildingId', data.dormBuildingId);
  assertUnlocked(user, 'dormRoomId', data.dormRoomId);

  const [buildingResult, roomResult] = await Promise.all([
    db.collection('dormBuildings').where({ buildingId: data.dormBuildingId }).limit(1).get(),
    db.collection('dormRooms').where({ roomId: data.dormRoomId, buildingId: data.dormBuildingId }).limit(1).get()
  ]);
  const building = buildingResult.data[0];
  const room = roomResult.data[0];
  if (!building || building.enabled === false || !room || room.enabled === false || room.floorNo !== Number(data.floorNo)) {
    throw fail('DORM_NOT_FOUND', '宿舍楼或房间信息无效');
  }

  const dormSnapshot = {
    buildingId: building.buildingId,
    buildingNo: building.buildingNo,
    buildingName: building.buildingName,
    roomId: room.roomId,
    floorNo: room.floorNo,
    doorplateNo: room.doorplateNo,
    roomNo: room.roomNo,
    fullRoomLabel: `${building.buildingName} ${room.floorNo}层 ${room.roomNo}室`
  };
  const updates = {
    realName: String(data.realName).trim(),
    studentNo: String(data.studentNo).trim(),
    dormBuildingId: data.dormBuildingId,
    dormRoomId: data.dormRoomId,
    // Replace the entire field so legacy null snapshots do not receive nested updates.
    dormSnapshot: db.command.set(dormSnapshot),
    profileCompleted: true,
    updatedAt: db.serverDate()
  };
  await db.collection('users').doc(user._id).update({ data: updates });
  return ok(toClientUser({ ...user, ...updates, dormSnapshot }));
}

module.exports = { me, completeProfile };
