<template>
  <view class="page">
    <view class="tab-bar">
      <view class="tb-item" :class="{ active: activeTab === 'products' }" @click="activeTab = 'products'">商品管理</view>
      <view class="tb-item" :class="{ active: activeTab === 'cats' }" @click="activeTab = 'cats'">分类管理</view>
    </view>

    <template v-if="activeTab === 'products'">
      <view class="search-row">
        <input class="search-box" v-model="keyword" placeholder="搜索商品名" />
      </view>
      <view class="toolbar">
        <picker mode="selector" :value="catIndex" :range="catLabels" @change="onCatChange">
          <view class="tool-btn">{{ activeCatName || '全部分类' }} ⌄</view>
        </picker>
        <view class="tool-btn primary" @click="openAdd">+ 添加商品</view>
      </view>

      <view v-if="loading" class="empty">加载中...</view>
      <view v-else-if="filteredProducts.length === 0" class="empty">暂无匹配商品</view>
      <view v-for="p in filteredProducts" :key="p._id" class="product-card">
        <image v-if="p.imageFileId" :src="p.imageFileId" class="card-img" mode="aspectFill" />
        <view v-else class="card-img-placeholder"></view>
        <view class="card-info">
          <view class="card-row1">
            <text class="card-name">{{ p.name }}</text>
            <text class="card-price">¥{{ p.price }}</text>
          </view>
          <text class="card-cat">{{ p.categoryName }} · {{ p.subName || '全部' }}</text>
        </view>
        <view class="card-actions">
          <text class="act-edit" @click="openEdit(p)">编辑</text>
          <text class="act-del" @click="confirmDelete(p)">删除</text>
        </view>
      </view>
    </template>

    <template v-if="activeTab === 'cats'">
      <view class="toolbar">
        <view class="tool-btn primary" @click="openCatAdd">+ 添加分类</view>
      </view>
      <view v-for="cat in managedCats" :key="cat._id || cat.key" class="cat-card">
        <view class="cat-header">
          <text class="cat-name">{{ cat.name }}</text>
          <view class="cat-act-btns">
            <text class="act-edit" @click="openCatEdit(cat)">编辑</text>
            <text class="act-del" @click="confirmCatDelete(cat)">删除</text>
          </view>
        </view>
        <view class="cat-subs">
          <text class="sub-tag" v-for="s in cat.subs" :key="s">{{ s }}</text>
          <text v-if="!cat.subs || !cat.subs.length" class="no-subs">无小分类</text>
        </view>
      </view>
      <view v-if="!managedCats.length" class="empty">暂无分类，请添加</view>
    </template>

    <view class="safe-bottom"></view>

    <view class="modal-mask" v-if="showModal" @click="showModal = false">
      <view class="modal" @click.stop>
        <view class="modal-title">{{ editingId ? '编辑商品' : '添加商品' }}</view>
        <view class="form-item">
          <text class="form-label">大分类</text>
          <picker mode="selector" :value="formCatIndex" :range="catLabels" @change="onFormCatChange">
            <view class="form-picker">{{ catLabels[formCatIndex] || '请选择' }}</view>
          </picker>
        </view>
        <view class="form-item" v-if="formSubcats.length">
          <text class="form-label">小分类</text>
          <picker mode="selector" :value="formSubIndex" :range="formSubcats" @change="onFormSubChange">
            <view class="form-picker">{{ formSubcats[formSubIndex] || '全部' }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">商品名</text>
          <input class="form-input" v-model="form.name" placeholder="请输入商品名" />
        </view>
        <view class="form-item">
          <text class="form-label">价格 ¥</text>
          <input class="form-input" v-model="form.price" type="digit" placeholder="0.00" />
        </view>
        <view class="form-item">
          <text class="form-label">商品图片</text>
          <view class="img-upload" @click="uploadImage">
            <image v-if="form.imageFileId" :src="form.imageFileId" class="upload-preview" mode="aspectFill" />
            <text v-else class="upload-hint">+ 点击上传</text>
          </view>
        </view>
        <view class="modal-btns">
          <view class="btn-cancel" @click="showModal = false">取消</view>
          <view class="btn-save" @click="saveProduct">保存</view>
        </view>
      </view>
    </view>

    <view class="modal-mask" v-if="showCatModal" @click="showCatModal = false">
      <view class="modal" @click.stop>
        <view class="modal-title">{{ editingCatId ? '编辑分类' : '添加分类' }}</view>
        <view class="form-item">
          <text class="form-label">分类名</text>
          <input class="form-input" v-model="catForm.name" placeholder="如：面包甜点" />
        </view>
        <view class="form-item">
          <text class="form-label">小分类（逗号分隔）</text>
          <input class="form-input" v-model="catForm.subsStr" placeholder="如：面包,甜点" />
        </view>
        <view class="modal-btns">
          <view class="btn-cancel" @click="showCatModal = false">取消</view>
          <view class="btn-save" @click="saveCat">保存</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../utils/request';
import { useUserStore } from '../../stores/user';
import { syncRoleSurface } from '../../utils/roleNavigation';

const store = useUserStore();
const activeTab = ref('products');

const defaultCats = [
  { key: 'bakery',   name: '面包甜点', subs: ['面包', '甜点'] },
  { key: 'instant',  name: '便当面点', subs: ['盒饭', '粥面类'] },
  { key: 'sushi',    name: '寿司饭团', subs: ['寿司', '饭团'] },
  { key: 'salad',    name: '沙拉轻食', subs: ['沙拉', '菜肴'] },
  { key: 'sandwich', name: '三明治',   subs: [] },
  { key: 'icecream', name: '冰淇淋',   subs: [] },
  { key: 'liquor',   name: '酒品',     subs: [] },
  { key: 'snack',    name: '休闲零食', subs: ['糖', '薯片', '巧克力', '饼干', '果冻'] },
  { key: 'drink',    name: '水饮饮料', subs: ['茶饮', '饮用水', '饮料', '乳制品'] },
  { key: 'case',     name: '整箱好物', subs: [] },
  { key: 'fastfood', name: '方便速食', subs: [] }
];

// 商品
const products = ref([]);
const loading = ref(false);
const keyword = ref('');
const catIndex = ref(0);
const showModal = ref(false);
const editingId = ref('');
const formCatIndex = ref(0);
const formSubIndex = ref(0);
const form = ref({ name: '', price: '', imageFileId: '' });

// 分类
const managedCats = ref([]);
const showCatModal = ref(false);
const editingCatId = ref('');
const catForm = ref({ name: '', subsStr: '' });

const categories = computed(() => managedCats.value.length ? managedCats.value : defaultCats);
const catLabels = computed(() => ['全部', ...categories.value.map(c => c.name)]);
const activeCatName = computed(() => catIndex.value === 0 ? '' : categories.value[catIndex.value - 1]?.name);
const filteredProducts = computed(() => {
  if (!keyword.value) return products.value;
  return products.value.filter(p => String(p.name || '').includes(keyword.value));
});
const formSubcats = computed(() => {
  if (formCatIndex.value === 0) return ['全部'];
  const cat = categories.value[formCatIndex.value - 1];
  return ['全部', ...(cat?.subs || [])];
});

onMounted(async () => { await syncRoleSurface(store, 'SUPER'); await loadCats(); loadProducts(); });

async function loadCats() {
  try {
    const res = await api.superGroceryCatList();
    managedCats.value = res?.items || [];
    if (managedCats.value.length === 0) {
      for (const c of defaultCats) await api.superGroceryCatSave({ name: c.name, subs: c.subs });
      const r2 = await api.superGroceryCatList();
      managedCats.value = r2?.items || [];
    }
  } catch (e) { managedCats.value = []; }
}

async function loadProducts() {
  loading.value = true;
  try {
    const params = {};
    if (catIndex.value > 0) params.category = categories.value[catIndex.value - 1].key;
    const res = await api.superGroceryProductList(params);
    const cats = categories.value;
    products.value = (res?.items || []).map(p => ({ ...p, categoryName: cats.find(c => c.key === p.category)?.name || p.category }));
  } catch (e) { products.value = []; }
  loading.value = false;
}

function onCatChange(e) { catIndex.value = e.detail.value; loadProducts(); }
function openAdd() { editingId.value = ''; form.value = { name: '', price: '', imageFileId: '' }; formCatIndex.value = 0; formSubIndex.value = 0; showModal.value = true; }
function openEdit(p) {
  editingId.value = p._id; const cats = categories.value; const ci = cats.findIndex(c => c.key === p.category);
  formCatIndex.value = ci >= 0 ? ci + 1 : 0;
  formSubIndex.value = p.sub ? (formSubcats.value.indexOf(p.sub) > 0 ? formSubcats.value.indexOf(p.sub) : 0) : 0;
  form.value = { name: p.name, price: typeof p.price === 'number' ? String(p.price) : (p.price || ''), imageFileId: p.imageFileId || '' };
  showModal.value = true;
}
function onFormCatChange(e) { formCatIndex.value = e.detail.value; formSubIndex.value = 0; }
function onFormSubChange(e) { formSubIndex.value = e.detail.value; }

async function uploadImage() {
  const r = await new Promise(r => wx.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: r }));
  uni.showLoading({ title: '上传中' });
  try { const up = await wx.cloud.uploadFile({ cloudPath: 'grocery/' + Date.now() + '.jpg', filePath: r.tempFilePaths[0] }); form.value.imageFileId = up.fileID; }
  catch (e) { uni.showToast({ title: '上传失败', icon: 'none' }); }
  uni.hideLoading();
}

async function saveProduct() {
  if (!form.value.name.trim()) return uni.showToast({ title: '请输入商品名', icon: 'none' });
  if (!Number(form.value.price) || Number(form.value.price) <= 0) return uni.showToast({ title: '请输入有效价格', icon: 'none' });
  if (formCatIndex.value === 0) return uni.showToast({ title: '请选择大分类', icon: 'none' });
  const cats = categories.value; const cat = cats[formCatIndex.value - 1];
  const sub = formSubcats.value[formSubIndex.value] || '全部';
  const payload = { name: form.value.name.trim(), price: Number(form.value.price), imageFileId: form.value.imageFileId || '',
    category: cat.key, categoryName: cat.name, sub: sub !== '全部' ? sub : '', subName: sub !== '全部' ? sub : '全部' };
  if (editingId.value) payload.id = editingId.value;
  try { await api.superGroceryProductSave(payload); showModal.value = false; loadProducts(); uni.showToast({ title: '保存成功', icon: 'success' }); }
  catch (e) { uni.showToast({ title: '保存失败: ' + (e.message || '请重试'), icon: 'none', duration: 3000 }); }
}

async function confirmDelete(p) {
  const r = await new Promise(r => uni.showModal({ title: '确认删除', content: '删除「' + p.name + '」?', success: r }));
  if (!r.confirm) return;
  try { await api.superGroceryProductDelete({ id: p._id }); loadProducts(); uni.showToast({ title: '已删除', icon: 'success' }); }
  catch (e) { uni.showToast({ title: '删除失败', icon: 'none' }); }
}

function openCatAdd() { editingCatId.value = ''; catForm.value = { name: '', subsStr: '' }; showCatModal.value = true; }
function openCatEdit(cat) { editingCatId.value = cat._id; catForm.value = { name: cat.name, subsStr: (cat.subs || []).join(',') }; showCatModal.value = true; }
async function saveCat() {
  if (!catForm.value.name.trim()) return uni.showToast({ title: '请输入分类名', icon: 'none' });
  const payload = { name: catForm.value.name.trim(), subs: catForm.value.subsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) };
  if (editingCatId.value) payload.id = editingCatId.value;
  try { await api.superGroceryCatSave(payload); showCatModal.value = false; loadCats(); uni.showToast({ title: '保存成功', icon: 'success' }); }
  catch (e) { uni.showToast({ title: '保存失败', icon: 'none' }); }
}
async function confirmCatDelete(cat) {
  const r = await new Promise(r => uni.showModal({ title: '确认删除', content: '删除分类「' + cat.name + '」?', success: r }));
  if (!r.confirm) return;
  try { await api.superGroceryCatDelete({ id: cat._id }); loadCats(); uni.showToast({ title: '已删除', icon: 'success' }); }
  catch (e) { uni.showToast({ title: '删除失败', icon: 'none' }); }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #F3F8FD; padding: 20rpx 32rpx; padding-bottom: 100rpx; }
.search-row { margin-bottom: 20rpx; position: relative; z-index: 1; }
.search-box { width: 100%; height: 72rpx; background: #fff; border-radius: 14rpx; padding: 0 28rpx; font-size: 28rpx; color: #2A4257; box-sizing: border-box; border: 1rpx solid #E3F1FD; }
.tab-bar { display: flex; background: #E3F1FD; border-radius: 14rpx; padding: 6rpx; margin-bottom: 24rpx; }
.tb-item { flex: 1; text-align: center; padding: 18rpx; font-size: 28rpx; color: #5A7A92; border-radius: 10rpx; }
.tb-item.active { background: #fff; color: #3E9BF0; font-weight: 600; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.tool-btn { padding: 16rpx 28rpx; background: #fff; border-radius: 14rpx; font-size: 26rpx; color: #5A7A92; border: 1rpx solid #E3F1FD; }
.tool-btn.primary { background: #3E9BF0; color: #fff; border-color: #3E9BF0; }
.empty { text-align: center; padding: 100rpx 0; color: #8AA3B8; }
.product-card { display: flex; align-items: center; gap: 20rpx; background: #fff; border-radius: 16rpx; padding: 20rpx; margin-bottom: 16rpx; border: 1rpx solid #E3F1FD; }
.card-img { width: 100rpx; height: 100rpx; border-radius: 12rpx; flex-shrink: 0; background: #F5F6F8; }
.card-img-placeholder { width: 100rpx; height: 100rpx; border-radius: 12rpx; flex-shrink: 0; background: #F5F6F8; }
.card-info { flex: 1; min-width: 0; }
.card-row1 { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6rpx; }
.card-name { font-size: 28rpx; font-weight: 600; color: #2A4257; }
.card-price { font-size: 28rpx; font-weight: 700; color: #FF7043; }
.card-cat { font-size: 22rpx; color: #8AA3B8; }
.card-actions { display: flex; flex-direction: column; gap: 12rpx; }
.act-edit { font-size: 24rpx; color: #3E9BF0; }
.act-del { font-size: 24rpx; color: #E57373; }
.cat-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; border: 1rpx solid #E3F1FD; }
.cat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.cat-name { font-size: 30rpx; font-weight: 600; color: #2A4257; }
.cat-act-btns { display: flex; gap: 20rpx; }
.cat-subs { display: flex; flex-wrap: wrap; gap: 12rpx; }
.sub-tag { font-size: 24rpx; padding: 6rpx 18rpx; background: #E3F1FD; color: #3E9BF0; border-radius: 20rpx; }
.no-subs { font-size: 24rpx; color: #B0B0B0; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: flex-end; }
.modal { width: 100%; background: #fff; border-radius: 24rpx 24rpx 0 0; padding: 32rpx; max-height: 85vh; overflow-y: auto; box-sizing: border-box; }
.modal-title { font-size: 34rpx; font-weight: 700; color: #2A4257; margin-bottom: 24rpx; text-align: center; }
.form-item { margin-bottom: 20rpx; }
.form-label { font-size: 26rpx; color: #5A7A92; margin-bottom: 10rpx; display: block; }
.form-input { width: 100%; height: 72rpx; background: #F5F6F8; border-radius: 12rpx; padding: 0 20rpx; font-size: 28rpx; box-sizing: border-box; }
.form-picker { height: 72rpx; line-height: 72rpx; background: #F5F6F8; border-radius: 12rpx; padding: 0 20rpx; font-size: 28rpx; color: #2A4257; }
.img-upload { width: 200rpx; height: 200rpx; background: #F5F6F8; border-radius: 12rpx; display: flex; align-items: center; justify-content: center; }
.upload-preview { width: 200rpx; height: 200rpx; border-radius: 12rpx; }
.upload-hint { font-size: 24rpx; color: #B0B0B0; }
.modal-btns { display: flex; gap: 20rpx; margin-top: 24rpx; }
.btn-cancel { flex: 1; text-align: center; padding: 24rpx; background: #F5F6F8; border-radius: 14rpx; font-size: 30rpx; color: #5A7A92; }
.btn-save { flex: 1; text-align: center; padding: 24rpx; background: #3E9BF0; border-radius: 14rpx; font-size: 30rpx; color: #fff; font-weight: 600; }
.safe-bottom { height: 60rpx; }
</style>