import { platforma } from '@platforma-open/milaboratories.samples-and-data.model';
import { defineAppV3 } from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import DatasetPage from './pages/DatasetPage.vue';
import MetadataPage from './pages/MetadataPage.vue';
import NewDatasetPage from './pages/NewDatasetPage.vue';

export const sdkPlugin = defineAppV3(platforma, (app) => {
  const showImportDataset = ref(false);

  if (app.model.data.datasets.length === 0 && !app.model.data.suggestedImport) {
    app.model.data.suggestedImport = true;
    showImportDataset.value = true;
  }

  const progresses = computed(() => app.model.outputs.fileImports ?? {});

  function inferNewDatasetLabel() {
    let i = app.model.data.datasets.length + 1;
    while (i < 1000) {
      let label = 'My Dataset';
      if (i > 0) {
        label = label + ` (${i})`;
      }
      if (app.model.data.datasets.findIndex((d) => d.label === label) === -1) return label;
      ++i;
    }
    return 'New Dataset';
  }

  return {
    showImportDataset,
    progresses,
    inferNewDatasetLabel,
    progress: () => {
      if (app.model.outputs.fileImports === undefined) return false;
      else {
        let totalDone = 0;
        let totalBytes = 0;
        let doneBytes = 0;
        let totalImports = 0;
        let totalWithUnknownSize = 0;
        let doneWithUnknownSize = 0;
        for (const fImport of Object.values(app.model.outputs.fileImports)) {
          totalImports++;
          if (fImport.done) totalDone++;
          if (fImport.status === undefined || !fImport.status.bytesTotal) {
            totalWithUnknownSize++;
            if (fImport.done) doneWithUnknownSize++;
          } else {
            totalBytes += fImport.status.bytesTotal;
            doneBytes += fImport.status.bytesProcessed ?? 0;
          }
        }
        // console.dir({
        //   totalDone,
        //   totalBytes,
        //   doneBytes,
        //   totalImports,
        //   totalWithUnknownSize,
        //   doneWithUnknownSize,
        // });
        if (totalDone === totalImports)
          return false;
        const knownSizeProgress = doneBytes / totalBytes;
        const unknownSizeProgress = doneWithUnknownSize / totalWithUnknownSize;
        let progress = 0;
        if (totalImports - totalWithUnknownSize > 0 && totalBytes > 0)
          progress += knownSizeProgress * (totalImports - totalWithUnknownSize);
        if (totalWithUnknownSize > 0)
          progress += unknownSizeProgress * totalWithUnknownSize;
        progress = progress / totalImports;
        // console.log(progress);
        return progress;
      }
    },
    routes: {
      '/': () => MetadataPage,
      '/dataset': () => DatasetPage,
      '/new-dataset': () => NewDatasetPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
