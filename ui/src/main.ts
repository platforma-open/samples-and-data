import '@milaboratories/uikit/styles';
import '@platforma-sdk/ui-vue/dist/style.css';
import { createApp } from 'vue';
import { sdkPlugin } from './app';
import { BlockLayout } from '@platforma-sdk/ui-vue';
import { LicenseManager } from '@ag-grid-enterprise/core';

const agGridLicense = getEnvironmentValue('AGGRID_LICENSE');
console.log(agGridLicense);
if (agGridLicense) {
  LicenseManager.setLicenseKey(agGridLicense);
  console.log(agGridLicense);
}

createApp(BlockLayout).use(sdkPlugin).mount('#app');
