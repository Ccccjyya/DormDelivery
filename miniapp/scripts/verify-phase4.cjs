const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pagesConfig = JSON.parse(fs.readFileSync(path.join(root, 'src/pages.json'), 'utf8'));
const routes = pagesConfig.pages.map((item) => item.path);
assert.strictEqual(new Set(routes).size, routes.length, '主包页面路由不能重复');

const expected = [
  'pages-super/dashboard/index', 'pages-super/rule-management/index',
  'pages-super/contribution-rules/index', 'pages-super/quota-rules/index',
  'pages-super/reward-rule/index', 'pages-super/complaint-rule/index',
  'pages-super/inactivity-rule/index', 'pages-super/account-management/index',
  'pages-super/admin-management/index', 'pages-super/announcement-management/index',
  'pages-super/audit-logs/index', 'pages-super/acceptance-stats/index'
];
for (const route of expected) {
  assert.ok(routes.includes(route), `缺少页面路由: ${route}`);
  assert.ok(fs.existsSync(path.join(root, 'src', `${route}.vue`)), `缺少页面文件: ${route}.vue`);
}

const dashboard = fs.readFileSync(path.join(root, 'src/pages-super/dashboard/index.vue'), 'utf8');
const menuLabels = ['规则管理', '账号管理', '管理员管理', '接单率统计', '公告管理', '操作记录', '退出登录'];
for (const label of menuLabels) assert.ok(dashboard.includes(label), `管理中心缺少菜单: ${label}`);
assert.ok(!dashboard.includes('返回普通用户端'), 'SUPER_ADMIN 不应显示返回普通用户端');
assert.ok(dashboard.includes("/pages-super/audit-logs/index"), '操作记录路由错误');

const announcement = fs.readFileSync(path.join(root, 'src/pages-super/announcement-management/index.vue'), 'utf8');
assert.ok(announcement.includes('>发布公告</button>'), '公告发布按钮不是静态中文');
assert.ok(!/>\s*e2\s*</i.test(announcement), '公告页面包含 e2 错误占位符');

const request = fs.readFileSync(path.join(root, 'src/utils/request.js'), 'utf8');
for (const action of ['rule.get', 'rule.update', 'super.accountList', 'super.accountStatus', 'super.adminRole',
  'super.operationLogs', 'announcement.adminList', 'announcement.save', 'announcement.offline',
  'announcement.list', 'announcement.detail', 'super.acceptanceStats']) assert.ok(request.includes(`'${action}'`), `请求层缺少 action: ${action}`);
assert.ok(!request.includes("'admin.acceptanceStats'"), 'ADMIN 请求层不应保留接单率统计 action');

const adminProfile = fs.readFileSync(path.join(root, 'src/pages-admin/profile/index.vue'), 'utf8');
assert.ok(!adminProfile.includes('接单率统计'), 'ADMIN 管理中心不应显示接单率统计');

const auditLogs = fs.readFileSync(path.join(root, 'src/pages-super/audit-logs/index.vue'), 'utf8');
for (const hiddenLabel of ['操作结果：', '修改前：', '修改后：', '操作人：']) {
  assert.ok(!auditLogs.includes(hiddenLabel), `超级管理员操作记录不应显示: ${hiddenLabel}`);
}
for (const actionLabel of ['账号禁用', '账号启用', '任命管理员', '取消管理员', '创建公告', '编辑公告', '发布公告', '下架公告']) {
  assert.ok(auditLogs.includes(actionLabel), `超级管理员操作记录缺少操作名称: ${actionLabel}`);
}

console.log('phase 4 frontend route checks passed');
