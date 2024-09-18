import { platforma } from '@milaboratory/milaboratories.samples-and-data.model';
import { defineApp } from '@milaboratory/sdk-vue';
import MetadataPage from './MetadataPage.vue';
import DatasetPage from './DatasetPage.vue';
import NewDatasetPage from './NewDatasetPage.vue';
import { computed } from 'vue';

export const sdkPlugin = defineApp(platforma, (app) => {
  const progresses = computed(() => app.outputs.fileImports?.ok ? app.outputs.fileImports.value ?? {} : {})

  return {
    progresses,
    routes: {
      '/': MetadataPage,
      '/dataset': DatasetPage,
      '/new-dataset': NewDatasetPage
    }
  };
});

export const useApp = sdkPlugin.useApp;
