const { fail } = require('./response');

function toClientUser(user) {
  const dormSnapshot = user.dormSnapshot && typeof user.dormSnapshot === 'object'
    ? user.dormSnapshot
    : {};

  return {
    id: user._id,
    realName: user.realName || '',
    studentNo: user.studentNo || '',
    dormBuildingId: user.dormBuildingId || null,
    dormBuildingName: dormSnapshot.buildingName || '',
    dormRoomId: user.dormRoomId || null,
    roomNo: dormSnapshot.roomNo || '',
    doorplateNo: dormSnapshot.doorplateNo || '',
    floorNo: dormSnapshot.floorNo || null,
    contributionScore: user.contributionScore ?? 60,
    postingQuota: user.postingQuota ?? 3,
    consecutiveInactiveWeeks: user.consecutiveInactiveWeeks ?? 0,
    role: user.role,
    accountStatus: user.accountStatus,
    publishBlocked: user.publishBlocked === true,
    acceptBlocked: user.acceptBlocked === true,
    publishBlockedReason: user.publishBlockedReason || '',
    acceptBlockedReason: user.acceptBlockedReason || '',
    locks: user.locks && typeof user.locks === 'object' ? user.locks : {},
    profileCompleted: Boolean(user.profileCompleted)
  };
}

function assertProfileInput(data) {
  const required = ['realName', 'studentNo', 'dormBuildingId', 'floorNo', 'dormRoomId'];
  for (const key of required) {
    if (data[key] === undefined || data[key] === null || data[key] === '') {
      throw fail('VALIDATION_ERROR', '请完整填写姓名、学号和宿舍信息');
    }
  }
}

function assertUnlocked(user, field, value) {
  const identityFields = ['realName', 'studentNo', 'dormBuildingId', 'dormRoomId'];
  const identityLocked = identityFields.some((key) => user.locks?.[key] === true);
  if (identityFields.includes(field) && identityLocked && user[field] !== value) {
    throw fail('FIELD_LOCKED', '已锁定');
  }
}

module.exports = { toClientUser, assertProfileInput, assertUnlocked };
