# 宿舍楼内互助取送平台

## 一、项目简介

- 项目名称：宿舍楼内互助取送平台
- 项目形态：微信小程序
- 项目用于同一宿舍楼用户发布、接取和完成取送需求。
- 系统包含普通用户、楼栋管理员和超级管理员功能。

## 二、技术栈

- uni-app
- Vue 3
- Pinia
- 微信小程序云开发
- Node.js 云函数
- CloudBase 云数据库
- CloudBase 云存储
- 微信 OpenID 登录

## 三、目录结构

```text
miniapp/                              小程序前端源码
cloudfunctions/api/                   主要业务云函数
cloudfunctions/initDormData/          宿舍楼和房间初始化云函数
cloudfunctions/scheduledMaintenance/  订单失效和贡献值结算定时任务
cloudfunctions/weeklyQuotaMaintenance/每周贡献值和发单次数结算任务
docs/                                 部署和数据库配置说明
```

## 四、环境要求

- Node.js
- npm
- 微信开发者工具
- 可用的微信小程序 AppID
- 已开通的 CloudBase 云开发环境
- 当前开发者具有该小程序和云开发环境的操作权限

## 五、项目配置

### 1. 小程序 AppID

配置文件：

```text
project.config.json
miniapp/src/manifest.json
```

### 2. CloudBase 环境 ID

配置文件：

```text
miniapp/src/config/cloudbase.js
```

部署人员需要将 AppID 和 CloudBase 环境 ID 替换为自己的配置。项目不需要在代码中填写 AppSecret、SecretId 或 SecretKey。

## 六、安装依赖和构建前端

在项目目录执行：

```powershell
cd miniapp
npm.cmd install
npm.cmd run build:mp-weixin
```

构建产物目录：

```text
miniapp/dist/build/mp-weixin
```

## 七、导入微信开发者工具

- 微信开发者工具应导入 GitHub 仓库根目录。
- `project.config.json` 已配置 `miniprogramRoot`。
- `project.config.json` 已配置 `cloudfunctionRoot`。
- 导入后确认 AppID 和云开发环境正确。
- 完成前端构建后，小程序应能在开发者工具中正常编译。

## 八、数据库准备

当前使用以下集合：

- `users`
- `orders`
- `complaints`
- `contributionRecords`
- `quotaRecords`
- `operationLogs`
- `dormBuildings`
- `dormRooms`
- `systemRules`
- `announcements`
- `weeklyQuotaRecords`

集合需要在 CloudBase 控制台中创建，字段会在云函数写入数据时自动生成。`systemRules` 可以保持为空，程序会使用默认规则。

`systemRules`、`announcements`、`weeklyQuotaRecords` 等核心集合的数据权限应设置为“所有用户不可读写”，小程序通过云函数访问数据。数据库索引按照 [CloudBase 部署与索引配置](docs/cloudbase-phase4-setup.md) 创建，不要删除已有集合和已有索引。

## 九、云函数部署

### 1. api

右键：

```text
cloudfunctions/api
```

选择“上传并部署：云端安装依赖”。

### 2. initDormData

右键：

```text
cloudfunctions/initDormData
```

选择“上传并部署：云端安装依赖”。首次初始化前，在该云函数的环境变量中设置临时 `DORM_SEED_TOKEN`，然后在云端调试中执行：

```json
{
  "confirmReset": true,
  "seedToken": "与环境变量一致的临时令牌"
}
```

该函数会重建宿舍楼和房间基础数据。已初始化过宿舍数据时不要重复执行，初始化完成后应删除或更换临时令牌。

### 3. scheduledMaintenance

右键：

```text
cloudfunctions/scheduledMaintenance
```

选择“上传并部署：云端安装依赖”，然后右键该云函数选择“上传触发器”。

### 4. weeklyQuotaMaintenance

右键：

```text
cloudfunctions/weeklyQuotaMaintenance
```

选择“上传并部署：云端安装依赖”，然后右键该云函数选择“上传触发器”。

## 十、定时触发器

### scheduledMaintenance

- 自动处理过期待接订单。
- 自动结算投诉期结束且无投诉的贡献值。
- 使用该云函数 `config.json` 中配置的执行周期。

### weeklyQuotaMaintenance

- 每周扣除贡献值。
- 处理连续无配送处罚。
- 清空上周剩余发单次数。
- 根据结算后的贡献值重新发放本周次数。
- 正式环境目标执行时间为每周一 00:00。

部署云函数后还需要单独上传触发器。修改 `config.json` 后必须重新上传触发器，并在 CloudBase 控制台确认触发器状态和执行时间。

## 十一、运行项目

完成以下操作后即可运行：

1. 前端依赖安装完成。
2. 前端构建成功。
3. 微信开发者工具导入仓库根目录。
4. CloudBase 环境 ID 配置正确。
5. 数据库集合和索引已创建。
6. `api` 云函数已部署。
7. 宿舍数据已初始化。
8. 两个定时维护云函数已部署。
9. 两个触发器已上传。

完成后在微信开发者工具中点击“编译”。

## 十二、更新部署

前端代码修改后执行：

```powershell
cd miniapp
npm.cmd run build:mp-weixin
```

然后重新编译或上传小程序版本。

- `api` 云函数代码修改后，重新上传并部署 `cloudfunctions/api`。
- 定时云函数代码修改后，重新部署对应云函数。
- 触发器时间修改后，重新上传对应触发器。
- 数据库查询出现索引错误时，按照错误提示和部署文档补充对应索引。

## 十三、常见部署问题

### 1. 页面仍显示旧内容

清除微信开发者工具编译缓存后，重新构建并编译。

### 2. 云函数代码没有生效

确认修改后的云函数已经重新上传并部署。

### 3. 定时任务没有执行

确认云函数已部署，并且触发器已单独上传和启用。

### 4. 查询提示缺少索引

进入 CloudBase 数据库索引管理，按照部署文档创建对应索引。

### 5. 小程序无法调用云函数

检查 AppID、CloudBase 环境 ID、云函数名称和开发者权限。

### 6. 页面显示空白或接口失败

查看微信开发者工具控制台和云函数日志，确认集合、索引和云函数部署完整。
