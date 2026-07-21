# CloudBase 部署与索引配置

## 集合与权限

在 CloudBase 控制台创建以下集合：

```text
users
orders
complaints
contributionRecords
quotaRecords
operationLogs
dormBuildings
dormRooms
systemRules
announcements
weeklyQuotaRecords
```

字段由云函数首次写入时生成。核心集合设置为“所有用户不可读写”，所有业务状态、身份、贡献值和角色修改均通过云函数完成。

## 必需索引

索引字段顺序必须与下表一致，仅对标记为“是”的索引启用唯一约束。

| 集合 | 索引名称 | 字段顺序 | 唯一 |
| --- | --- | --- | --- |
| users | uniq_openid | openid ASC | 是 |
| users | idx_role_status | role ASC, accountStatus ASC | 否 |
| users | idx_building_created_at | dormBuildingId ASC, createdAt DESC | 否 |
| dormBuildings | uniq_building_id | buildingId ASC | 是 |
| dormRooms | uniq_room_id | roomId ASC | 是 |
| dormRooms | idx_building_floor_room | buildingId ASC, floorNo ASC, roomNo ASC | 否 |
| orders | order_no_unique | orderNo ASC | 是 |
| orders | publisher_request_unique | publisherId ASC, clientRequestId ASC | 是 |
| orders | idx_building_created_at | buildingId ASC, createdAt DESC | 否 |
| orders | idx_building_status_created_at | buildingId ASC, status ASC, createdAt DESC | 否 |
| orders | idx_publisher_created_at | publisherId ASC, createdAt DESC | 否 |
| orders | idx_receiver_created_at | receiverId ASC, createdAt DESC | 否 |
| orders | idx_reward_settlement_due | status ASC, rewardStatus ASC, complaintStatus ASC, complaintDeadline ASC | 否 |
| orders | idx_reward_settlement_legacy | status ASC, rewardStatus ASC, complaintStatus ASC, complaintDeadline ASC, completedAt ASC | 否 |
| orders | idx_waiting_expiration_due | status ASC, withdrawn ASC, expiresAt ASC | 否 |
| orders | idx_waiting_expiration_legacy | status ASC, expiresAt ASC, createdAt ASC | 否 |
| orders | idx_receiver_status_completed | receiverId ASC, status ASC, completedAt ASC | 否 |
| complaints | uniq_order_id | orderId ASC | 是 |
| complaints | idx_complainant_created_at | complainantId ASC, createdAt DESC | 否 |
| complaints | idx_status_building_created_at | status ASC, orderBuildingId ASC, createdAt DESC | 否 |
| contributionRecords | uniq_idempotency_key | idempotencyKey ASC | 是 |
| contributionRecords | idx_user_created_at | userId ASC, createdAt DESC | 否 |
| quotaRecords | uniq_quota_idempotency | idempotencyKey ASC | 是 |
| quotaRecords | idx_quota_user_created | userId ASC, createdAt DESC | 否 |
| operationLogs | idx_operator_building_created_at | operatorId ASC, targetBuildingId ASC, createdAt DESC | 否 |
| operationLogs | idx_operator_role_created | operatorRole ASC, createdAt DESC | 否 |
| announcements | idx_announcement_status_published | status ASC, publishedAt DESC | 否 |
| announcements | idx_announcement_created | createdAt DESC | 否 |
| weeklyQuotaRecords | uniq_weekly_quota_idempotency | idempotencyKey ASC | 是 |
| weeklyQuotaRecords | idx_weekly_user_period | userId ASC, periodEnd DESC | 否 |
| weeklyQuotaRecords | idx_weekly_week_created | weekKey ASC, createdAt DESC | 否 |

CloudBase 控制台操作路径：数据库 → 选择集合 → 索引管理 → 新建索引。

## 云函数部署顺序

1. 上传并部署 `cloudfunctions/api`，选择云端安装依赖。
2. 上传并部署 `cloudfunctions/initDormData`，仅在需要初始化或重建宿舍数据时执行。
3. 上传并部署 `cloudfunctions/scheduledMaintenance`，随后上传触发器。
4. 上传并部署 `cloudfunctions/weeklyQuotaMaintenance`，随后上传触发器。

## 正式触发器

`scheduledMaintenance` 每 10 分钟执行一次：

```text
0 */10 * * * * *
```

`weeklyQuotaMaintenance` 每周一 00:00 执行：

```text
0 0 0 * * MON *
```

Cron 使用七段格式：秒、分、时、日、月、星期、年。上传后应在 CloudBase 控制台确认触发器已启用，并确认控制台显示的时区符合预期。
