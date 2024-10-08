import '@platforma-sdk/ui-vue/styles';
import { createApp, ref } from 'vue';
import { sdkPlugin } from './app';
import { BlockLayout } from '@platforma-sdk/ui-vue';
import { SuggestedImport } from './types';

const app = createApp(BlockLayout).use(sdkPlugin);
app.provide(SuggestedImport, ref(false));
app.mount('#app');
