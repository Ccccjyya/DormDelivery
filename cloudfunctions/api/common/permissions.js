const { fail } = require('./response');

const ROLES = Object.freeze({ USER: 'USER', ADMIN: 'ADMIN', SUPER_ADMIN: 'SUPER_ADMIN', MERCHANT: 'MERCHANT' });

function assertActive(user) {
  if (!user) throw fail('UNAUTHORIZED', '请先完成微信身份登录');
  if (user.accountStatus !== 'ACTIVE') throw fail('ACCOUNT_DISABLED', '账号已被禁用');
  return user;
}

function requireExactRole(user, role) {
  assertActive(user);
  if (user.role !== role) throw fail('FORBIDDEN', '权限不足');
  return user;
}

function requireUserRole(user) {
  assertActive(user);
  if (user.role !== ROLES.USER && user.role !== ROLES.ADMIN) throw fail('FORBIDDEN', '权限不足');
  return user;
}

function requireAdminOrMerchant(user) {
  assertActive(user);
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.MERCHANT) throw fail('FORBIDDEN', '权限不足');
  return user;
}

module.exports = { ROLES, assertActive, requireExactRole, requireUserRole, requireAdminOrMerchant };
