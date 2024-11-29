import { platforma } from '@platforma-open/milaboratories.samples-and-data.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import DatasetPage from './DatasetPage.vue';
import MetadataPage from './MetadataPage.vue';

export const sdkPlugin = defineApp(platforma, (app) => {
  const progresses = computed(() => app.model.outputs.fileImports ?? {});

  return {
    progresses,
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
        console.dir({
          totalDone,
          totalBytes,
          doneBytes,
          totalImports,
          totalWithUnknownSize,
          doneWithUnknownSize
        });
        if (totalDone === totalImports) return false;
        const knownSizeProgress = doneBytes / totalBytes;
        const unknownSizeProgress = doneWithUnknownSize / totalWithUnknownSize;
        let progress = 0;
        if (totalImports - totalWithUnknownSize > 0 && totalBytes > 0)
          progress += knownSizeProgress * (totalImports - totalWithUnknownSize);
        if (totalWithUnknownSize > 0) progress += unknownSizeProgress * totalWithUnknownSize;
        progress = progress / totalImports;
        console.log(progress);
        return progress;
      }
    },
    routes: {
      '/': () => MetadataPage,
      '/dataset': () => DatasetPage
    }
  };
});

export const useApp = sdkPlugin.useApp;
