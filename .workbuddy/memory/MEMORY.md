# DormDelivery 项目记忆

## 项目身份
- 微信小程序：宿舍楼内互助取送平台
- 技术栈：uni-app + Vue3 + Pinia（前端） / Node.js 云函数（后端） / CloudBase 云数据库+存储
- 前端源码在 `miniapp/src/`，构建产物在 `miniapp/dist/build/mp-weixin/`
- 云函数在 `cloudfunctions/`（api / initDormData / scheduledMaintenance / weeklyQuotaMaintenance）

## 部署关键配置（已确认）
- 小程序 AppID（团队共享）：`wxfc481877185149ea`（已在 project.config.json / manifest.json 填好）
- CloudBase 环境 ID：`cloud1-d0g51zhvo764bc013`（已填 miniapp/src/config/cloudbase.js）
- 构建命令：`cd miniapp && npm install` → `npm run build:mp-weixin`
- 部署分工：我（WorkBuddy）做填配置/装依赖/构建前端；云端建集合索引、上传云函数、配定时器由用户用微信开发者工具+CloudBase 控制台完成（需用户微信扫码授权）

## 重要约束 / 用户偏好
- 用户是**微信小程序开发新手**，讲解要白话、配图、循序渐进
- 用户**拒绝了命令行 rm 删除操作**（sandbox 拦截 + 用户否认）→ 不要自动删除 node_modules 或本地文件，改用更安全方式或让用户手动删
- 用户希望"先确认前端构建好，再手动建索引"，不要白干活
