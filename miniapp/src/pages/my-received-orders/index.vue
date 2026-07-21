<template><OrderList ref="orderList" title="我的接单" :loader="api.myReceived" /></template>
<script setup>
import { onPullDownRefresh } from '@dcloudio/uni-app';
import { ref } from 'vue';
import OrderList from '../../shared/OrderList.vue';
import { api } from '../../utils/request';
import { runPullDownRefresh } from '../../utils/pullDownRefresh';
const orderList = ref(null);
onPullDownRefresh(() => runPullDownRefresh(() => orderList.value?.refresh()));
</script>
