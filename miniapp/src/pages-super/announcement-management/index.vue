<template><view class="page"><view class="title">公告管理</view>
  <view class="card editor"><view class="field-label">公告标题</view><input class="input" v-model="form.title" placeholder="请输入公告标题" maxlength="80"/><view class="field-label">公告内容</view><textarea class="textarea" v-model="form.content" placeholder="请输入公告内容" maxlength="2000"/>
    <button v-if="form.announcementId" class="btn publish-button" :loading="saving" @click="confirmPublish">保存并发布</button><button v-else class="btn publish-button" :loading="saving" @click="confirmPublish">发布公告</button><button v-if="form.announcementId" class="btn secondary" @click="resetForm">取消编辑</button>
  </view>
  <view class="section-title">历史公告</view><view v-if="errorMessage" class="error-state"><view>{{ errorMessage }}</view><button class="retry" @click="load(true)">重新加载</button></view><view v-else-if="loading&&!items.length" class="empty">公告加载中…</view>
  <template v-else><view v-for="item in items" :key="item.id" class="card"><view class="row"><text class="item-title">{{ item.title }}</text><text class="status">{{ item.status==='PUBLISHED'?'已发布':'已下架' }}</text></view><view class="muted">发布时间：{{ formatDateTime(item.publishedAt||item.createdAt) }}</view><button class="btn secondary" @click="edit(item)">编辑公告</button><button v-if="item.status==='PUBLISHED'" class="btn danger" @click="offline(item)">下架公告</button></view><view v-if="!items.length" class="empty">暂无公告</view><view v-else-if="!hasMore" class="end">没有更多了</view></template>
</view></template>
<script setup>
import { onLoad,onPullDownRefresh,onReachBottom,onShow } from '@dcloudio/uni-app';import { reactive,ref } from 'vue';import { api } from '../../utils/request';import { formatDateTime } from '../../utils/orderDisplay';import { useUserStore } from '../../stores/user';import { syncRoleSurface } from '../../utils/roleNavigation';import { runPullDownRefresh } from '../../utils/pullDownRefresh';
const store=useUserStore();const form=reactive({announcementId:'',title:'',content:'',announcementType:'GENERAL',relatedRuleType:null,relatedRuleVersion:null});const items=ref([]);const page=ref(0);const hasMore=ref(true);const loading=ref(false);const saving=ref(false);const errorMessage=ref('');let draftOptions=null;
function resetForm(){Object.assign(form,{announcementId:'',title:'',content:'',announcementType:'GENERAL',relatedRuleType:null,relatedRuleVersion:null})}
async function load(reset=false){if(loading.value||(!reset&&!hasMore.value))return;if(reset){items.value=[];page.value=0;hasMore.value=true}loading.value=true;errorMessage.value='';try{const auth=await syncRoleSurface(store,'SUPER');if(!auth.allowed)return;const result=await api.superAnnouncements({page:page.value});items.value.push(...(result.items||[]));page.value+=1;hasMore.value=result.hasMore===true}catch(error){console.error('announcement list failed',{action:'announcement.adminList',page:'公告管理',code:error?.code,message:error?.message});errorMessage.value=error?.message||'公告加载失败，请稍后重试'}finally{loading.value=false}}
function confirmPublish(){const title=form.title.trim();const content=form.content.trim();if(!title)return uni.showToast({title:'请输入公告标题',icon:'none'});if(!content)return uni.showToast({title:'请输入公告内容',icon:'none'});uni.showModal({title:'确认发布',content:'确认发布当前公告？',success:async({confirm})=>{if(!confirm||saving.value)return;saving.value=true;try{await api.saveAnnouncement({...form,title,content});uni.showToast({title:'发布成功',icon:'success'});resetForm();draftOptions=null;await load(true)}catch(error){console.error('announcement save failed',{action:'announcement.save',page:'公告管理',code:error?.code,message:error?.message})}finally{saving.value=false}}})}
function edit(item){Object.assign(form,{announcementId:item.id,title:item.title,content:item.content,announcementType:item.announcementType||'GENERAL',relatedRuleType:item.relatedRuleType||null,relatedRuleVersion:item.relatedRuleVersion||null});uni.pageScrollTo({scrollTop:0,duration:200})}
function offline(item){uni.showModal({title:'确认下架',content:'确认下架该公告？',success:async({confirm})=>{if(!confirm)return;try{await api.offlineAnnouncement(item.id);uni.showToast({title:'已下架',icon:'success'});await load(true)}catch(error){console.error('announcement offline failed',{action:'announcement.offline',page:'公告管理',code:error?.code,message:error?.message})}}})}
const bandRanges=[[0,9],[10,19],[20,29],[30,39],[40,49],[50,59],[60,69],[70,79],[80,89],[90,100]];
function decodeOption(value){try{return decodeURIComponent(value||'')}catch(_){return String(value||'')}}
function conciseRuleDraft(options){
  const title=decodeOption(options.title);const ruleType=String(options.ruleType||'');const incoming=decodeOption(options.content);
  const ruleName=title.replace(/更新$/,'')||'业务规则';
  let after=(incoming.split('修改后：')[1]||'').split(/\n(?:规则版本|生效时间)：/)[0].trim();
  if(['WEEKLY_DEDUCTION','WEEKLY_POSTING_QUOTA'].includes(ruleType)&&!after.includes('分：')){
    const values=after.split(/[、,，\s]+/).filter((item)=>item!==''&&!Number.isNaN(Number(item)));
    if(values.length===10){const quota=ruleType==='WEEKLY_POSTING_QUOTA';after=bandRanges.map(([min,max],index)=>`${min}～${max}分：${quota?'每周发放':'每周扣除'}${values[index]}${quota?'次':'贡献值'}`).join('\n')}
  }
  if(!after.includes('：')){
    const descriptions={COMPLETION_REWARD:`按时完成配送且无成立投诉：增加${after}贡献值`,COMPLAINT_PENALTY:`投诉成立：扣除${after}贡献值`,INACTIVE_EXTRA_PENALTY:`连续超过两周无配送：每周额外扣除${after}贡献值`};
    after=descriptions[ruleType]||after;
  }
  return `规则类型：${ruleName}\n修改后：\n${after}`;
}
onLoad((options)=>{if(['1','2'].includes(options.draft)){draftOptions=options;Object.assign(form,{title:decodeOption(options.title),content:conciseRuleDraft(options),announcementType:'RULE_UPDATE',relatedRuleType:options.ruleType||null,relatedRuleVersion:Number(options.ruleVersion)||null})}});onShow(()=>load(true));onReachBottom(()=>load());onPullDownRefresh(()=>runPullDownRefresh(()=>load(true)));
</script>
<style scoped>.editor{padding-bottom:20rpx}.field-label{margin-bottom:10rpx;font-weight:600}.textarea{width:100%;height:280rpx;padding:20rpx;border:1px solid #cfded9;border-radius:6px;box-sizing:border-box}.publish-button{color:#fff}.section-title{font-size:32rpx;font-weight:600;margin:30rpx 0 16rpx}.item-title{font-weight:600;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.error-state{text-align:center;color:#b42318;padding:70rpx 0}.retry{width:220rpx;margin-top:20rpx;font-size:26rpx}.end{text-align:center;color:#6a7d76;padding:24rpx}</style>
