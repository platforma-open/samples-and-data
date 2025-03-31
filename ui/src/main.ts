import '@platforma-sdk/ui-vue/styles';
import { createApp, ref } from 'vue';
import { sdkPlugin } from './app';
import { BlockLayout } from '@platforma-sdk/ui-vue';

const app = createApp(BlockLayout).use(sdkPlugin);
app.mount('#app');
