import { BlockLayout } from '@platforma-sdk/ui-vue';
import { createApp } from 'vue';
import { sdkPlugin } from './app';

const app = createApp(BlockLayout).use(sdkPlugin);
app.mount('#app');
