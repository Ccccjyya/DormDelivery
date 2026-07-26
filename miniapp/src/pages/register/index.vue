<template>
  <view class="page">
    <view class="title">完善资料</view>
    <view class="subtitle">{{ roleMode === 'student' ? '姓名、学号和宿舍信息将用于同楼互助与身份核验' : '请提交商家信息以便审核' }}</view>

    <view class="role-toggle">
      <view class="rt-option" :class="{ active: roleMode === 'student' }" @click="switchRole('student')">
        <text class="rt-text">我是学生</text>
      </view>
      <view class="rt-option" :class="{ active: roleMode === 'merchant' }" @click="switchRole('merchant')">
        <text class="rt-text">我是商家</text>
      </view>
    </view>

    <view class="card">
      <!-- 学生表单 -->
      <template v-if="roleMode === 'student'">
        <view class="field-label">学号</view>
        <input class="input" v-model="studentForm.studentNo" placeholder="请输入学号" />
        <view class="field-label">姓名</view>
        <input class="input" v-model="studentForm.realName" placeholder="请输入姓名" />

        <view class="field-label">宿舍楼</view>
        <picker :range="buildings" range-key="buildingName" :value="selectedBuildingIndex" @change="pickBuilding">
          <view class="input picker-value">{{ buildingName || '请选择宿舍楼' }}</view>
        </picker>
        <view v-if="buildingLoadError" class="field-hint error">宿舍楼加载失败 <text class="retry" @click="loadBuildings">重试</text></view>

        <view class="field-label">楼层</view>
        <view @click="promptFloorPicker">
          <picker :range="floorPickerOptions" range-key="label" :value="selectedFloorIndex" :disabled="!studentForm.dormBuildingId || floorsLoading || floorPickerOptions.length === 0" @change="pickFloor">
            <view class="input picker-value" :class="{ disabled: !studentForm.dormBuildingId || floorsLoading || floorPickerOptions.length === 0 }">{{ floorLabel }}</view>
          </picker>
        </view>
        <view v-if="!studentForm.dormBuildingId" class="field-hint">请先选择宿舍楼</view>
        <view v-else-if="floorsLoading" class="field-hint">正在加载楼层</view>
        <view v-else-if="floorLoadError" class="field-hint error">楼层加载失败 <text class="retry" @click="loadFloors(studentForm.dormBuildingId)">重试</text></view>
        <view v-else-if="floorPickerOptions.length === 0" class="field-hint">当前宿舍楼暂无可选楼层</view>

        <view class="field-label">门牌号</view>
        <view @click="promptRoomPicker">
          <picker :range="roomPickerOptions" range-key="label" :value="selectedRoomIndex" :disabled="!hasSelectedFloor || roomsLoading || roomPickerOptions.length === 0" @change="pickRoom">
            <view class="input picker-value" :class="{ disabled: !hasSelectedFloor || roomsLoading || roomPickerOptions.length === 0 }">{{ roomLabel }}</view>
          </picker>
        </view>
        <view v-if="!hasSelectedFloor" class="field-hint">请先选择楼层</view>
        <view v-else-if="roomsLoading" class="field-hint">正在加载门牌号</view>
        <view v-else-if="roomLoadError" class="field-hint error">门牌号加载失败 <text class="retry" @click="loadRooms(studentForm.dormBuildingId, studentForm.floorNo)">重试</text></view>
        <view v-else-if="roomPickerOptions.length === 0" class="field-hint">当前楼层暂无可选门牌号</view>

        <button class="btn" :loading="saving" @click="registerStudent">保存并进入首页</button>
      </template>

      <!-- 商家表单 -->
      <template v-else>
        <view class="field-label">联系人姓名</view>
        <input class="input" v-model="merchantForm.contactName" placeholder="请输入联系人姓名" />
        <view class="field-label">手机号</view>
        <input class="input" v-model="merchantForm.phone" placeholder="请输入手机号" />
        <view class="field-label">便利店名称</view>
        <input class="input" v-model="merchantForm.storeName" placeholder="如：2号楼楼下便利店" />
        <view class="field-label">便利店位置</view>
        <input class="input" v-model="merchantForm.storeAddress" placeholder="如：东门入口左侧" />

        <view class="field-label">资质证明</view>
        <view class="upload-list">
          <view v-for="(img, i) in merchantForm.certImages" :key="i" class="upload-item">
            <image :src="img" class="upload-preview" mode="aspectFill" @click="previewImg(img)" />
            <view class="upload-remove" @click="removeImg(i)">×</view>
          </view>
          <view v-if="merchantForm.certImages.length < 6" class="upload-add" @click="chooseImg">
            <text class="add-icon">+</text>
            <text class="add-text">添加图片</text>
          </view>
        </view>
        <view class="field-hint">可上传多张：营业执照、身份证等证明材料</view>

        <view class="field-label">文字说明</view>
        <textarea class="input textarea" v-model="merchantForm.description" placeholder="如相关证明说明（营业执照、身份信息等）" />

        <button class="btn" :loading="saving" @click="registerMerchant">提交审核</button>
      </template>
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../../utils/request';
import { useUserStore } from '../../stores/user';
import { safeReLaunch } from '../../utils/navigation';

const store = useUserStore();
const roleMode = ref('student');

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

const studentForm = reactive({ studentNo: '', realName: '', dormBuildingId: null, floorNo: null, dormRoomId: null });
const merchantForm = reactive({ contactName: '', phone: '', storeName: '', storeAddress: '', description: '', certImages: [] });

const buildingName = computed(() => buildings.value.find((b) => b.buildingId === studentForm.dormBuildingId)?.buildingName);
const hasSelectedFloor = computed(() => studentForm.floorNo !== null && studentForm.floorNo !== undefined);
const selectedBuildingIndex = computed(() => Math.max(0, buildings.value.findIndex((b) => b.buildingId === studentForm.dormBuildingId)));
const selectedFloorIndex = computed(() => Math.max(0, floorPickerOptions.value.findIndex((f) => f.value === studentForm.floorNo)));
const selectedRoomIndex = computed(() => Math.max(0, roomPickerOptions.value.findIndex((r) => r.roomId === studentForm.dormRoomId)));
const floorLabel = computed(() => hasSelectedFloor.value ? `${studentForm.floorNo}层` : '请选择楼层');
const roomLabel = computed(() => roomPickerOptions.value.find((r) => r.roomId === studentForm.dormRoomId)?.label || '请选择门牌号');

onMounted(loadBuildings);

function switchRole(mode) {
  roleMode.value = mode;
}

async function loadBuildings() {
  buildingLoadError.value = false;
  try { buildings.value = await api.buildings(); } catch { buildingLoadError.value = true; }
}

async function loadFloors(buildingId) {
  const req = ++floorLoadSequence;
  floorLoadError.value = false;
  floorsLoading.value = true;
  try {
    const floors = await api.floors(buildingId);
    if (req === floorLoadSequence) floorPickerOptions.value = floors.map((v) => ({ value: Number(v), label: `${v}层` }));
  } catch {
    if (req === floorLoadSequence) floorLoadError.value = true;
  } finally {
    if (req === floorLoadSequence) floorsLoading.value = false;
  }
}

async function loadRooms(buildingId, floorNo) {
  const req = ++roomLoadSequence;
  roomLoadError.value = false;
  roomsLoading.value = true;
  try {
    const rooms = await api.rooms(buildingId, floorNo);
    if (req === roomLoadSequence) roomPickerOptions.value = rooms.map((r) => ({ ...r, label: r.roomNo }));
  } catch {
    if (req === roomLoadSequence) roomLoadError.value = true;
  } finally {
    if (req === roomLoadSequence) roomsLoading.value = false;
  }
}

function pickBuilding(event) {
  const b = buildings.value[event.detail.value];
  if (!b) return;
  studentForm.dormBuildingId = b.buildingId;
  studentForm.floorNo = null;
  studentForm.dormRoomId = null;
  floorPickerOptions.value = [];
  roomPickerOptions.value = [];
  loadFloors(b.buildingId);
}

function pickFloor(event) {
  const f = floorPickerOptions.value[event.detail.value];
  if (!f) return;
  studentForm.floorNo = f.value;
  studentForm.dormRoomId = null;
  roomPickerOptions.value = [];
  loadRooms(studentForm.dormBuildingId, f.value);
}

function pickRoom(event) {
  const r = roomPickerOptions.value[event.detail.value];
  if (r) studentForm.dormRoomId = r.roomId;
}

function promptFloorPicker() {
  if (!studentForm.dormBuildingId) uni.showToast({ title: '请先选择宿舍楼', icon: 'none' });
}

function promptRoomPicker() {
  if (!hasSelectedFloor.value) uni.showToast({ title: '请先选择楼层', icon: 'none' });
}

function chooseImg() {
  wx.chooseMedia({ count: 6 - merchantForm.certImages.length, mediaType: ['image'], sourceType: ['album', 'camera'], success(res) {
    res.tempFiles.forEach(f => {
      wx.cloud.uploadFile({ cloudPath: 'merchant/cert/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg', filePath: f.tempFilePath, success(upRes) {
        merchantForm.certImages.push(upRes.fileID);
      }, fail() {
        uni.showToast({ title: '上传失败', icon: 'none' });
      }});
    });
  }});
}

function removeImg(i) {
  merchantForm.certImages.splice(i, 1);
}

function previewImg(img) {
  wx.previewImage({ current: img, urls: merchantForm.certImages });
}

async function registerStudent() {
  saving.value = true;
  try {
    const profile = await api.completeProfile(studentForm);
    store.profile = profile;
    uni.setStorageSync('cloudProfile', profile);
    await safeReLaunch('/pages/tabbar-home/index');
  } finally {
    saving.value = false;
  }
}

async function registerMerchant() {
  if (!merchantForm.contactName.trim()) return uni.showToast({ title: '请填写联系人姓名', icon: 'none' });
  if (!merchantForm.phone.trim()) return uni.showToast({ title: '请输入手机号', icon: 'none' });
  if (!merchantForm.storeName.trim()) return uni.showToast({ title: '请填写便利店名称', icon: 'none' });
  if (!merchantForm.storeAddress.trim()) return uni.showToast({ title: '请填写便利店位置', icon: 'none' });
  if (!merchantForm.description.trim()) return uni.showToast({ title: '请填写相关证明说明', icon: 'none' });
  if (merchantForm.certImages.length === 0) return uni.showToast({ title: '请上传资质证明图片', icon: 'none' });
  saving.value = true;
  try {
    await api.merchantApply({
      contactName: merchantForm.contactName.trim(),
      phone: merchantForm.phone.trim(),
      storeName: merchantForm.storeName.trim(),
      storeAddress: merchantForm.storeAddress.trim(),
      description: merchantForm.description.trim(),
      certImages: merchantForm.certImages
    });
    uni.showToast({ title: '提交成功，待审核', icon: 'success' });
    setTimeout(async () => {
      await safeReLaunch('/pages-merchant/dashboard/index');
    }, 800);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.role-toggle { display: flex; gap: 16rpx; margin: 0 0 24rpx; }
.rt-option { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 28rpx 0; background: #fff; border-radius: 14rpx; border: 2rpx solid #E3F1FD; }
.rt-option.active { background: #E3F1FD; border-color: #3E9BF0; }
.rt-icon { font-size: 48rpx; margin-bottom: 8rpx; }
.rt-text { font-size: 28rpx; color: #2A4257; font-weight: 500; }
.rt-option.active .rt-text { color: #3E9BF0; font-weight: 700; }

.field-label { margin: 14rpx 0 10rpx; font-size: 27rpx; font-weight: 600; }
.picker-value { display: flex; align-items: center; color: #7A93A8; }
.picker-value.disabled { color: #9aa8a4; background: #f4f6f5; }
.field-hint { margin: -8rpx 0 16rpx; color: #7A93A8; font-size: 24rpx; }
.field-hint.error { color: #b94738; }
.retry { margin-left: 16rpx; color: #3E9BF0; }
.textarea { height: 180rpx; padding: 20rpx; box-sizing: border-box; }

.upload-list { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 8rpx; }
.upload-item { position: relative; width: 180rpx; height: 180rpx; }
.upload-preview { width: 100%; height: 100%; border-radius: 10rpx; }
.upload-remove { position: absolute; top: -10rpx; right: -10rpx; width: 36rpx; height: 36rpx; background: rgba(0,0,0,0.6); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30rpx; line-height: 1; }
.upload-add { width: 180rpx; height: 180rpx; background: #F5F6F8; border-radius: 10rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2rpx dashed #C2E2FC; }
.add-icon { font-size: 60rpx; color: #3E9BF0; line-height: 1; }
.add-text { font-size: 22rpx; color: #8AA3B8; margin-top: 4rpx; }
</style>