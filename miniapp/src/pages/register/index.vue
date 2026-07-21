<template>
  <view class="page">
    <view class="title">完善资料</view>
    <view class="subtitle">姓名、学号和宿舍信息将用于同楼互助与身份核验</view>
    <view class="card">
      <view class="field-label">学号</view>
      <input class="input" v-model="form.studentNo" placeholder="请输入学号" />
      <view class="field-label">姓名</view>
      <input class="input" v-model="form.realName" placeholder="请输入姓名" />

      <view class="field-label">宿舍楼</view>
      <picker :range="buildings" range-key="buildingName" :value="selectedBuildingIndex" @change="pickBuilding">
        <view class="input picker-value">{{ buildingName || '请选择宿舍楼' }}</view>
      </picker>
      <view v-if="buildingLoadError" class="field-hint error">宿舍楼加载失败 <text class="retry" @click="loadBuildings">重试</text></view>

      <view class="field-label">楼层</view>
      <view @click="promptFloorPicker">
        <picker :range="floorPickerOptions" range-key="label" :value="selectedFloorIndex" :disabled="!form.dormBuildingId || floorsLoading || floorPickerOptions.length === 0" @change="pickFloor">
          <view class="input picker-value" :class="{ disabled: !form.dormBuildingId || floorsLoading || floorPickerOptions.length === 0 }">{{ floorLabel }}</view>
        </picker>
      </view>
      <view v-if="!form.dormBuildingId" class="field-hint">请先选择宿舍楼</view>
      <view v-else-if="floorsLoading" class="field-hint">正在加载楼层</view>
      <view v-else-if="floorLoadError" class="field-hint error">楼层加载失败 <text class="retry" @click="loadFloors(form.dormBuildingId)">重试</text></view>
      <view v-else-if="floorPickerOptions.length === 0" class="field-hint">当前宿舍楼暂无可选楼层</view>

      <view class="field-label">门牌号</view>
      <view @click="promptRoomPicker">
        <picker :range="roomPickerOptions" range-key="label" :value="selectedRoomIndex" :disabled="!hasSelectedFloor || roomsLoading || roomPickerOptions.length === 0" @change="pickRoom">
          <view class="input picker-value" :class="{ disabled: !hasSelectedFloor || roomsLoading || roomPickerOptions.length === 0 }">{{ roomLabel }}</view>
        </picker>
      </view>
      <view v-if="!hasSelectedFloor" class="field-hint">请先选择楼层</view>
      <view v-else-if="roomsLoading" class="field-hint">正在加载门牌号</view>
      <view v-else-if="roomLoadError" class="field-hint error">门牌号加载失败 <text class="retry" @click="loadRooms(form.dormBuildingId, form.floorNo)">重试</text></view>
      <view v-else-if="roomPickerOptions.length === 0" class="field-hint">当前楼层暂无可选门牌号</view>

      <button class="btn" :loading="saving" @click="register">保存并进入首页</button>
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../../utils/request';
import { useUserStore } from '../../stores/user';
import { safeReLaunch } from '../../utils/navigation';

const store = useUserStore();
const buildings = ref([]);
const floorPickerOptions = ref([]);
const roomPickerOptions = ref([]);
const floorsLoading = ref(false);
const roomsLoading = ref(false);
const buildingLoadError = ref(false);
const floorLoadError = ref(false);
const roomLoadError = ref(false);
const saving = ref(false);
let floorLoadSequence = 0;
let roomLoadSequence = 0;
const form = reactive({ studentNo: '', realName: '', dormBuildingId: null, floorNo: null, dormRoomId: null });
const buildingName = computed(() => buildings.value.find((building) => building.buildingId === form.dormBuildingId)?.buildingName);
const hasSelectedFloor = computed(() => form.floorNo !== null && form.floorNo !== undefined);
const selectedBuildingIndex = computed(() => Math.max(0, buildings.value.findIndex((building) => building.buildingId === form.dormBuildingId)));
const selectedFloorIndex = computed(() => Math.max(0, floorPickerOptions.value.findIndex((floor) => floor.value === form.floorNo)));
const selectedRoomIndex = computed(() => Math.max(0, roomPickerOptions.value.findIndex((room) => room.roomId === form.dormRoomId)));
const floorLabel = computed(() => hasSelectedFloor.value ? `${form.floorNo}层` : '请选择楼层');
const roomLabel = computed(() => roomPickerOptions.value.find((room) => room.roomId === form.dormRoomId)?.label || '请选择门牌号');

onMounted(loadBuildings);

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
  const floor = floorPickerOptions.value[event.detail.value];
  if (!floor) return;
  form.floorNo = floor.value;
  form.dormRoomId = null;
  roomPickerOptions.value = [];
  loadRooms(form.dormBuildingId, floor.value);
}

function pickRoom(event) {
  const room = roomPickerOptions.value[event.detail.value];
  if (room) form.dormRoomId = room.roomId;
}

function promptFloorPicker() {
  if (!form.dormBuildingId) uni.showToast({ title: '请先选择宿舍楼', icon: 'none' });
}

function promptRoomPicker() {
  if (!hasSelectedFloor.value) uni.showToast({ title: '请先选择楼层', icon: 'none' });
}

async function register() {
  saving.value = true;
  try {
    const profile = await api.completeProfile(form);
    store.profile = profile;
    uni.setStorageSync('cloudProfile', profile);
    await safeReLaunch('/pages/home/index');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.field-label { margin: 14rpx 0 10rpx; font-size: 27rpx; font-weight: 600; }
.picker-value { display: flex; align-items: center; color: #52635e; }
.picker-value.disabled { color: #9aa8a4; background: #f4f6f5; }
.field-hint { margin: -8rpx 0 16rpx; color: #6a7d76; font-size: 24rpx; }
.field-hint.error { color: #b94738; }
.retry { margin-left: 16rpx; color: #147a69; }
</style>
