import { platforma } from '@platforma-open/milaboratories.samples-and-data.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import DatasetPage from './DatasetPage.vue';
import MetadataPage from './MetadataPage.vue';

export const sdkPlugin = defineApp(platforma, (app) => {
  const progresses = computed(() => app.outputs.fileImports?.ok ? app.outputs.fileImports.value ?? {} : {})

  return {
    progresses,
    routes: {
      '/': MetadataPage,
      '/dataset': DatasetPage
    }
  };
});

export const useApp = sdkPlugin.useApp;
