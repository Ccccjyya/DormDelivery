<template>
  <view class="page">
    <view class="title">编辑资料</view>
    <view class="card">
      <view class="field-label">姓名</view>
      <view @click="notifyLocked('realName')"><input class="input" v-model="form.realName" :disabled="isLocked('realName')" placeholder="请输入姓名" /></view>
      <view class="field-label">学号</view>
      <view @click="notifyLocked('studentNo')"><input class="input" v-model="form.studentNo" :disabled="isLocked('studentNo')" placeholder="请输入学号" /></view>

      <view class="field-label">宿舍楼</view>
      <view @click="promptBuildingPicker">
        <picker :range="buildings" range-key="buildingName" :value="selectedBuildingIndex" :disabled="identityLocked" @change="pickBuilding">
          <view class="input picker-value" :class="{ disabled: identityLocked }">{{ buildingName || '请选择宿舍楼' }}</view>
        </picker>
      </view>
      <view v-if="!identityLocked && buildingLoadError" class="field-hint error">宿舍楼加载失败 <text class="retry" @click="loadBuildings">重试</text></view>

      <view class="field-label">楼层</view>
      <view @click="promptFloorPicker">
        <picker :range="floorPickerOptions" range-key="label" :value="selectedFloorIndex" :disabled="identityLocked || !form.dormBuildingId || floorsLoading || floorPickerOptions.length === 0" @change="pickFloor">
          <view class="input picker-value" :class="{ disabled: identityLocked || !form.dormBuildingId || floorsLoading || floorPickerOptions.length === 0 }">{{ floorLabel }}</view>
        </picker>
      </view>
      <view v-if="!identityLocked && !form.dormBuildingId" class="field-hint">请先选择宿舍楼</view>
      <view v-else-if="!identityLocked && floorsLoading" class="field-hint">正在加载楼层</view>
      <view v-else-if="!identityLocked && floorLoadError" class="field-hint error">楼层加载失败 <text class="retry" @click="loadFloors(form.dormBuildingId)">重试</text></view>
      <view v-else-if="!identityLocked && floorPickerOptions.length === 0" class="field-hint">当前宿舍楼暂无可选楼层</view>

      <view class="field-label">门牌号</view>
      <view @click="promptRoomPicker">
        <picker :range="roomPickerOptions" range-key="label" :value="selectedRoomIndex" :disabled="identityLocked || !hasSelectedFloor || roomsLoading || roomPickerOptions.length === 0" @change="pickRoom">
          <view class="input picker-value" :class="{ disabled: identityLocked || !hasSelectedFloor || roomsLoading || roomPickerOptions.length === 0 }">{{ roomLabel }}</view>
        </picker>
      </view>
      <view v-if="!identityLocked && !hasSelectedFloor" class="field-hint">请先选择楼层</view>
      <view v-else-if="!identityLocked && roomsLoading" class="field-hint">正在加载门牌号</view>
      <view v-else-if="!identityLocked && roomLoadError" class="field-hint error">门牌号加载失败 <text class="retry" @click="loadRooms(form.dormBuildingId, form.floorNo)">重试</text></view>
      <view v-else-if="!identityLocked && roomPickerOptions.length === 0" class="field-hint">当前楼层暂无可选门牌号</view>

      <button class="btn" :disabled="identityLocked" @click="save">{{ identityLocked ? '已锁定' : '保存' }}</button>
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../../utils/request';

const form = reactive({ realName: '', studentNo: '', dormBuildingId: null, floorNo: null, dormRoomId: null });
const profile = ref(null);
const buildings = ref([]);
const floorPickerOptions = ref([]);
const roomPickerOptions = ref([]);
const floorsLoading = ref(false);
const roomsLoading = ref(false);
const buildingLoadError = ref(false);
const floorLoadError = ref(false);
const roomLoadError = ref(false);
let floorLoadSequence = 0;
let roomLoadSequence = 0;
const buildingName = computed(() => buildings.value.find((building) => building.buildingId === form.dormBuildingId)?.buildingName || profile.value?.dormBuildingName || '');
const hasSelectedFloor = computed(() => form.floorNo !== null && form.floorNo !== undefined);
const selectedBuildingIndex = computed(() => Math.max(0, buildings.value.findIndex((building) => building.buildingId === form.dormBuildingId)));
const selectedFloorIndex = computed(() => Math.max(0, floorPickerOptions.value.findIndex((floor) => floor.value === form.floorNo)));
const selectedRoomIndex = computed(() => Math.max(0, roomPickerOptions.value.findIndex((room) => room.roomId === form.dormRoomId)));
const floorLabel = computed(() => hasSelectedFloor.value ? `${form.floorNo}层` : '请选择楼层');
const roomLabel = computed(() => roomPickerOptions.value.find((room) => room.roomId === form.dormRoomId)?.label || profile.value?.doorplateNo || (profile.value?.roomNo ? String(profile.value.roomNo).slice(-2).padStart(2, '0') : '请选择门牌号'));
const identityLocked = computed(() => ['realName', 'studentNo', 'dormBuildingId', 'dormRoomId'].some((field) => profile.value?.locks?.[field] === true));

onMounted(async () => {
  profile.value = await api.me();
  Object.assign(form, profile.value);
  if (identityLocked.value) return;
  await loadBuildings();
  if (!form.dormBuildingId || !hasSelectedFloor.value) return;
  await loadFloors(form.dormBuildingId);
  await loadRooms(form.dormBuildingId, form.floorNo);
});

async function loadBuildings() {
  buildingLoadError.value = false;
  try { buildings.value = await api.buildings(); } catch { buildingLoadError.value = true; }
}

async function loadFloors(buildingId) {
  const requestId = ++floorLoadSequence;
  floorLoadError.value = false;
  floorsLoading.value = true;
  try {
    const floors = await api.floors(buildingId);
    if (requestId === floorLoadSequence) floorPickerOptions.value = floors.map((value) => ({ value: Number(value), label: `${value}层` }));
  } catch {
    if (requestId === floorLoadSequence) floorLoadError.value = true;
  } finally {
    if (requestId === floorLoadSequence) floorsLoading.value = false;
  }
}

async function loadRooms(buildingId, floorNo) {
  const requestId = ++roomLoadSequence;
  roomLoadError.value = false;
  roomsLoading.value = true;
  try {
    const rooms = await api.rooms(buildingId, floorNo);
    if (requestId === roomLoadSequence) roomPickerOptions.value = rooms.map((room) => ({ ...room, label: room.roomNo }));
  } catch {
    if (requestId === roomLoadSequence) roomLoadError.value = true;
  } finally {
    if (requestId === roomLoadSequence) roomsLoading.value = false;
  }
}

function pickBuilding(event) {
  if (identityLocked.value) return notifyLocked();
  const building = buildings.value[event.detail.value];
  if (!building) return;
  form.dormBuildingId = building.buildingId;
  form.floorNo = null;
  form.dormRoomId = null;
  floorPickerOptions.value = [];
  roomPickerOptions.value = [];
  loadFloors(building.buildingId);
}

function pickFloor(event) {
  if (identityLocked.value) return notifyLocked();
  const floor = floorPickerOptions.value[event.detail.value];
  if (!floor) return;
  form.floorNo = floor.value;
  form.dormRoomId = null;
  roomPickerOptions.value = [];
  loadRooms(form.dormBuildingId, floor.value);
}

function pickRoom(event) {
  if (identityLocked.value) return notifyLocked();
  const room = roomPickerOptions.value[event.detail.value];
  if (room) form.dormRoomId = room.roomId;
}

function promptFloorPicker() {
  if (identityLocked.value) return notifyLocked();
  if (!form.dormBuildingId) uni.showToast({ title: '请先选择宿舍楼', icon: 'none' });
}

function promptRoomPicker() {
  if (identityLocked.value) return notifyLocked();
  if (!hasSelectedFloor.value) uni.showToast({ title: '请先选择楼层', icon: 'none' });
}

function promptBuildingPicker() { if (identityLocked.value) notifyLocked(); }
function isLocked() { return identityLocked.value; }
function notifyLocked() { if (identityLocked.value) uni.showToast({ title: '已锁定', icon: 'none' }); }

async function save() {
  if (identityLocked.value) return notifyLocked();
  try {
    await api.updateMe(form);
    uni.navigateBack();
  } catch (error) {
    if (error?.code !== 'FIELD_LOCKED') throw error;
    profile.value = await api.me();
    form.realName = profile.value.realName;
    form.studentNo = profile.value.studentNo;
  }
}
</script>

<style scoped>
.field-label { margin: 14rpx 0 10rpx; font-size: 27rpx; font-weight: 600; }
.picker-value { display: flex; align-items: center; color: #52635e; }
.picker-value.disabled { color: #9aa8a4; background: #f4f6f5; }
.input[disabled] { color: #7d8b87; background: #f1f4f3; }
.field-hint { margin: -8rpx 0 16rpx; color: #6a7d76; font-size: 24rpx; }
.field-hint.error { color: #b94738; }
.retry { margin-left: 16rpx; color: #147a69; }
</style>
