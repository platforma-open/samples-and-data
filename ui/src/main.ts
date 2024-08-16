import '@milaboratory/platforma-uikit/styles';
import '@milaboratory/sdk-vue/lib/dist/style.css';
import { createApp } from 'vue';
import { sdkPlugin } from './app';
import { BlockLayout } from '@milaboratory/sdk-vue';

createApp(BlockLayout).use(sdkPlugin).mount('#app');
