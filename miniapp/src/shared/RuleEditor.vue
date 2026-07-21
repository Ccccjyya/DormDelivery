<template>
  <view class="page">
    <view class="title">{{ title }}</view>
    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="errorMessage" class="error-state"><view>{{ errorMessage }}</view><button class="retry" @click="load">重新加载</button></view>
    <template v-else-if="rules">
      <view v-if="mode === 'bands'" class="card band-list">
        <view v-for="(band, index) in rules.contributionBands" :key="band.min" class="band-row">
          <text class="band-label">{{ band.min }}～{{ band.max }}</text>
          <input class="number-input" type="number" v-model="values[index]" />
        </view>
      </view>
      <view v-else class="card">
        <view class="field-label">{{ fieldLabel }}</view>
        <input class="input" type="number" v-model="value" />
      </view>
      <button class="btn" :loading="saving" @click="confirmSave">保存规则</button>
      <button class="btn secondary" @click="createAnnouncementDraft">发布公告</button>
    </template>
  </view>
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { api } from '../utils/request';
import { useUserStore } from '../stores/user';
import { syncRoleSurface } from '../utils/roleNavigation';

const props = defineProps({ title: String, ruleType: String, mode: { type: String, default: 'scalar' }, field: String, fieldLabel: String, help: String });
const store=useUserStore();const rules = ref(null); const values = ref([]); const value = ref(''); const loading = ref(false); const saving = ref(false);const errorMessage=ref('');
async function load() {
  loading.value = true;errorMessage.value='';
  try {
    const auth=await syncRoleSurface(store,'SUPER');if(!auth.allowed)return;
    rules.value = await api.superRules();
    values.value = rules.value.contributionBands.map((band) => String(props.ruleType === 'WEEKLY_DEDUCTION' ? band.weeklyDeduction : band.weeklyPostingQuota));
    value.value = String(rules.value[props.field] ?? '');
  } catch(error){console.error('rule page load failed',{action:'rule.get',page:props.title,code:error?.code,message:error?.message});errorMessage.value=error?.message||'规则加载失败，请稍后重试';rules.value=null} finally { loading.value = false; }
}
function payload() {
  return props.mode === 'bands'
    ? { ruleType: props.ruleType, values: values.value.map(Number) }
    : { ruleType: props.ruleType, value: Number(value.value) };
}
function confirmSave() {
  const numbers=props.mode==='bands'?values.value.map(Number):[Number(value.value)];
  const max=props.ruleType==='WEEKLY_POSTING_QUOTA'?20:100;
  if(numbers.some((item)=>!Number.isInteger(item)||item<0||item>max))return uni.showToast({title:`请输入0到${max}的整数`,icon:'none'});
  uni.showModal({ title: '确认保存', content: '确认保存当前规则配置？', success: async ({ confirm }) => {
    if (!confirm || saving.value) return;
    saving.value = true;
    try { rules.value = await api.updateSuperRule(payload()); uni.showToast({ title: '保存成功', icon: 'success' }); await load(); }
    catch(error){console.error('rule save failed',{action:'rule.update',page:props.title,code:error?.code,message:error?.message})}finally { saving.value = false; }
  } });
}
function bandRuleLines() {
  const isQuota = props.ruleType === 'WEEKLY_POSTING_QUOTA';
  return rules.value.contributionBands.map((band, index) => {
    const configuredValue = values.value[index];
    const ruleText = isQuota
      ? `每周发放${configuredValue}次`
      : `每周扣除${configuredValue}贡献值`;
    return `${band.min}～${band.max}分：${ruleText}`;
  });
}
function scalarRuleLine() {
  const descriptions = {
    COMPLETION_REWARD: `按时完成配送且无成立投诉：增加${value.value}贡献值`,
    COMPLAINT_PENALTY: `投诉成立：扣除${value.value}贡献值`,
    INACTIVE_EXTRA_PENALTY: `连续超过两周无配送：每周额外扣除${value.value}贡献值`
  };
  return descriptions[props.ruleType] || `${props.fieldLabel}：${value.value}`;
}
function createAnnouncementDraft() {
  const after = props.mode === 'bands' ? bandRuleLines().join('\n') : scalarRuleLine();
  const title = `${props.title}更新`;
  const content = `规则类型：${props.title}\n修改后：\n${after}`;
  uni.navigateTo({ url: `/pages-super/announcement-management/index?draft=2&ruleType=${encodeURIComponent(props.ruleType)}&ruleVersion=${rules.value?.version || 1}&title=${encodeURIComponent(title)}&content=${encodeURIComponent(content)}` });
}
onShow(load);
</script>

<style scoped>
.band-list{padding:12rpx 24rpx}.band-row{display:flex;align-items:center;justify-content:space-between;padding:16rpx 0;border-bottom:1rpx solid #e5efec}.band-row:last-child{border-bottom:0}.band-label{width:180rpx}.number-input{width:180rpx;height:68rpx;border:1px solid #cfded9;border-radius:6px;text-align:center}.field-label{font-weight:600;margin-bottom:14rpx}.input{margin-bottom:0}.error-state{text-align:center;color:#b42318;padding:70rpx 0}.retry{width:220rpx;margin-top:20rpx;font-size:26rpx}
</style>
