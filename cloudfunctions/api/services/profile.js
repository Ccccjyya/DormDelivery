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

async function merchantApply({ db, user, data }) {
  assertActive(user);
  const contactName = String(data.contactName || '').trim();
  const phone = String(data.phone || '').trim();
  const storeName = String(data.storeName || '').trim();
  const storeAddress = String(data.storeAddress || '').trim();
  const description = String(data.description || '').trim();
  const certImages = Array.isArray(data.certImages) ? data.certImages : [];
  if (!contactName) return fail('VALIDATION_ERROR', '请填写联系人姓名');
  if (!phone) return fail('VALIDATION_ERROR', '请输入手机号');
  if (!storeName) return fail('VALIDATION_ERROR', '请填写便利店名称');
  if (!storeAddress) return fail('VALIDATION_ERROR', '请填写便利店位置');
  if (!description) return fail('VALIDATION_ERROR', '请填写相关证明说明');
  if (certImages.length === 0) return fail('VALIDATION_ERROR', '请上传资质证明图片');
  const application = {
    userId: user._id,
    openid: user.openid,
    realName: user.realName || '',
    contactName, phone, storeName, storeAddress, description,
    certImages,
    status: 'PENDING',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };
  await db.collection('merchantApplications').add({ data: application });
  await db.collection('users').doc(user._id).update({ data: {
    phone,
    merchantApplication: db.command.set(application),
    profileCompleted: true,
    updatedAt: db.serverDate()
  }});
  return ok({ submitted: true });
}

async function myMerchantApplication({ db, user }) {
  assertActive(user);
  const res = await db.collection('merchantApplications').where({ userId: user._id }).orderBy('createdAt', 'desc').limit(1).get();
  return ok(res.data[0] || null);
}

module.exports = { me, completeProfile, merchantApply, myMerchantApplication };
