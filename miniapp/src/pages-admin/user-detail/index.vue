<template>
  <view class="page">
    <view class="title">用户详情</view>
    <view v-if="errorMessage" class="empty">{{ errorMessage }}</view>
    <template v-if="user">
      <view class="card summary">
        <view>角色：{{ roleLabel(user.role) }}</view>
        <view>账号状态：{{ user.accountStatus === 'ACTIVE' ? '正常' : '已禁用' }}</view>
        <view>贡献值：{{ user.contributionScore }}</view>
        <view>剩余发单：{{ user.postingQuota }}次</view>
      </view>

      <view class="card">
        <view class="section-title">业务资料</view>
        <view class="field-label">姓名</view>
        <input class="input" v-model="form.realName" />
        <view class="field-label">学号</view>
        <input class="input" v-model="form.studentNo" />
        <view class="field-label">宿舍楼</view>
        <picker :range="buildings" range-key="buildingName" :value="buildingIndex" @change="changeBuilding">
          <view class="picker">{{ selectedBuildingName || '请选择宿舍楼' }}</view>
        </picker>
        <view class="field-label">楼层</view>
        <picker :range="floorOptions" range-key="label" :value="floorIndex" :disabled="!form.dormBuildingId" @change="changeFloor">
          <view class="picker">{{ floorOptions[floorIndex]?.label || '请选择楼层' }}</view>
        </picker>
        <view class="field-label">门牌号</view>
        <picker :range="roomOptions" range-key="label" :value="roomIndex" :disabled="!form.floorNo" @change="changeRoom">
          <view class="picker">{{ roomOptions[roomIndex]?.label || '请选择门牌号' }}</view>
        </picker>

        <view class="switch-row"><text>锁定姓名、学号和宿舍信息</text><switch :checked="identityLocked" @change="changeIdentityLock" /></view>
        <button class="btn" :loading="saving" @click="saveProfile">保存资料</button>
      </view>

      <button class="btn secondary permission-button" :disabled="restricting" @click="toggleBusinessPermission">{{ restrictionButtonText }}</button>
    </template>
  </view>
</template>

<script setup>
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { api } from '../../utils/request';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';

const IDENTITY_LOCK_FIELDS = ['realName', 'studentNo', 'dormBuildingId', 'dormRoomId'];
const userId = ref('');
const user = ref(null);
const admin = ref(null);
const buildings = ref([]);
const floors = ref([]);
const rooms = ref([]);
const saving = ref(false);
const restricting = ref(false);
const businessBlocked = ref(false);
const errorMessage = ref('');
const form = ref({ realName: '', studentNo: '', dormBuildingId: '', floorNo: null, dormRoomId: '', locks: {} });

const floorOptions = computed(() => floors.value.map((value) => ({ value, label: `${value}层` })));
const roomOptions = computed(() => rooms.value.map((room) => ({ value: room.roomId, label: String(room.doorplateNo || room.roomNo || '').padStart(2, '0'), room })));
const buildingIndex = computed(() => Math.max(0, buildings.value.findIndex((item) => item.buildingId === form.value.dormBuildingId)));
const floorIndex = computed(() => Math.max(0, floorOptions.value.findIndex((item) => item.value === form.value.floorNo)));
const roomIndex = computed(() => Math.max(0, roomOptions.value.findIndex((item) => item.value === form.value.dormRoomId)));
const selectedBuildingName = computed(() => buildings.value.find((item) => item.buildingId === form.value.dormBuildingId)?.buildingName || '');
const identityLocked = computed(() => IDENTITY_LOCK_FIELDS.some((field) => form.value.locks[field] === true));
const restrictionButtonText = computed(() => restricting.value ? '处理中' : businessBlocked.value ? '启用发单和接单' : '禁止发单和接单');

async function load() {
  try {
    errorMessage.value = '';
    admin.value = await api.me();
    user.value = await api.adminUserDetail(userId.value);
    businessBlocked.value = user.value.publishBlocked === true || user.value.acceptBlocked === true;
    buildings.value = await api.buildings();
    const dorm = user.value.dormSnapshot || {};
    form.value = {
      realName: user.value.realName,
      studentNo: user.value.studentNo,
      dormBuildingId: user.value.dormBuildingId || dorm.buildingId || '',
      floorNo: Number(dorm.floorNo) || null,
      dormRoomId: user.value.dormRoomId || dorm.roomId || '',
      locks: { ...(user.value.locks || {}) }
    };
    await loadFloors(form.value.dormBuildingId);
    await loadRooms(form.value.dormBuildingId, form.value.floorNo);
  } catch (error) {
    errorMessage.value = typeof error?.code === 'string' && error?.message ? error.message : '加载失败，请稍后重试';
  }
}

async function loadFloors(buildingId) {
  floors.value = buildingId ? await api.floors(buildingId) : [];
}

async function loadRooms(buildingId, floorNo) {
  rooms.value = buildingId && floorNo ? await api.rooms(buildingId, floorNo) : [];
}

async function changeBuilding(event) {
  const building = buildings.value[event.detail.value];
  if (!building) return;
  form.value.dormBuildingId = building.buildingId;
  form.value.floorNo = null;
  form.value.dormRoomId = '';
  floors.value = [];
  rooms.value = [];
  await loadFloors(building.buildingId);
}

async function changeFloor(event) {
  const floor = floorOptions.value[event.detail.value];
  if (!floor) return;
  form.value.floorNo = floor.value;
  form.value.dormRoomId = '';
  rooms.value = [];
  await loadRooms(form.value.dormBuildingId, floor.value);
}

function changeRoom(event) {
  form.value.dormRoomId = roomOptions.value[event.detail.value]?.value || '';
}

function changeIdentityLock(event) {
  const locked = event.detail.value === true;
  for (const field of IDENTITY_LOCK_FIELDS) form.value.locks[field] = locked;
}

async function saveProfile() {
  if (saving.value) return;
  if (!form.value.dormBuildingId) return uni.showToast({ title: '请选择宿舍楼', icon: 'none' });
  if (!form.value.floorNo) return uni.showToast({ title: '请选择楼层', icon: 'none' });
  if (!form.value.dormRoomId) return uni.showToast({ title: '请选择门牌号', icon: 'none' });
  const previousBuildingId = user.value.dormBuildingId || user.value.dormSnapshot?.buildingId;
  const movedToAnotherBuilding = previousBuildingId !== form.value.dormBuildingId;
  const editingSelf = user.value.id === admin.value.id;
  saving.value = true;
  try {
    await api.adminUpdateUserProfile({ userId: userId.value, ...form.value });
    uni.showToast({ title: '资料已保存', icon: 'success' });
    if (movedToAnotherBuilding && !editingSelf) setTimeout(() => uni.navigateBack(), 500);
    else await load();
  } finally {
    saving.value = false;
  }
}

async function toggleBusinessPermission() {
  if (restricting.value) return;
  const blocked = !businessBlocked.value;
  restricting.value = true;
  try {
    await api.setBusinessRestrictions({ userId: userId.value, type: 'BOTH', blocked });
    await load();
    uni.showToast({ title: blocked ? '已禁止发单和接单' : '已启用发单和接单', icon: 'success' });
  } catch (error) {
  } finally {
    restricting.value = false;
  }
}

function roleLabel(role) { return role === 'ADMIN' ? '管理员' : '普通用户'; }

onLoad((query) => {
  userId.value = String(query.userId || '').trim();
  if (!userId.value) { errorMessage.value = '用户信息无效'; return; }
  load();
});
onPullDownRefresh(() => runPullDownRefresh(() => userId.value ? load() : undefined));
</script>

<style scoped>
.summary,.card{line-height:1.9}.section-title{font-weight:600;margin-bottom:14rpx}.field-label{font-size:26rpx;font-weight:600;margin:8rpx 0}.picker{padding:20rpx;margin-bottom:18rpx;background:#fff;border:1rpx solid #cfded9;border-radius:6px}.switch-row{display:flex;align-items:center;justify-content:space-between;margin:14rpx 0}.permission-button{margin-top:20rpx}
</style>
