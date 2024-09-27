import '@milaboratories/uikit/styles';
import '@platforma-sdk/ui-vue/dist/style.css';
import { createApp } from 'vue';
import { sdkPlugin } from './app';
import { BlockLayout } from '@platforma-sdk/ui-vue';

createApp(BlockLayout).use(sdkPlugin).mount('#app');
