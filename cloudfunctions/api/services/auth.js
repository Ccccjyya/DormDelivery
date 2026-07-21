const { ROLES, assertActive } = require('../common/permissions');
const { ok, fail } = require('../common/response');
const { toClientUser } = require('../common/users');

async function login({ db, openid }) {
  if (!openid) throw fail('UNAUTHORIZED', '无法获取微信 OpenID');
  const users = db.collection('users');
  const existing = await users.where({ openid }).limit(1).get();
  let user = existing.data[0];

  if (!user) {
    const created = {
      openid,
      role: ROLES.USER,
      accountStatus: 'ACTIVE',
      profileCompleted: false,
      realName: '',
      studentNo: '',
      dormBuildingId: null,
      dormRoomId: null,
      dormSnapshot: {},
      locks: {},
      contributionScore: 60,
      postingQuota: 3,
      consecutiveInactiveWeeks: 0,
      publishBlocked: false,
      acceptBlocked: false,
      publishBlockedReason: '',
      acceptBlockedReason: '',
      publishBlockedAt: null,
      acceptBlockedAt: null,
      publishBlockedBy: null,
      acceptBlockedBy: null,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
    try {
      const result = await users.add({ data: created });
      user = { ...created, _id: result._id };
    } catch (error) {
      const retried = await users.where({ openid }).limit(1).get();
      if (!retried.data[0]) throw error;
      user = retried.data[0];
    }
  }

  assertActive(user);
  return ok({ profile: toClientUser(user), needsProfile: !user.profileCompleted });
}

module.exports = { login };
