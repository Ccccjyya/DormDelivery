import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { initCloudBase } from './config/cloudbase';

export function createApp() {
  initCloudBase();
  const app = createSSRApp(App);
  app.use(createPinia());
  return { app };
}
