import type { ImportFileHandle } from '@platforma-sdk/model';
import { ReactiveFileContent } from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import { readFileForImport } from '../dataimport';
import { DEFAULT_MAX_FILE_SIZE, useTableImport } from './useTableImport';

export function useMetadataImport() {
  const app = useApp();
  const reactiveFileContent = ReactiveFileContent.useGlobal();
  const { state: importState, clearImportCandidate, clearErrorMessage } = useTableImport();

  const fileDialogOpened = ref(false);

  const metadataFileBytes = computed(() => {
    const handle = app.model.outputs.metadataFile;
    if (!handle) return undefined;
    return reactiveFileContent.getContentBytes(handle.handle).value;
  });

  // Parse bytes and populate importState. Returns true on success, false on failure.
  function processTableBytes(bytes: Uint8Array): boolean {
    try {
      const ic = readFileForImport(bytes);
      if (ic.data.columns.length === 0 || ic.data.rows.length === 0) {
        importState.errorMessage = { title: 'Table is empty', message: 'The file does not contain any data to import.' };
        return false;
      }
      importState.importCandidate = ic;
      return true;
    } catch (e) {
      importState.errorMessage = {
        title: 'Error reading table',
        message: e instanceof Error ? e.message : String(e),
      };
      return false;
    }
  }

  watch(metadataFileBytes, (bytes) => {
    if (bytes === undefined) return;
    if (app.model.args.metadataUploadHandle === undefined) return;
    if (importState.importCandidate !== undefined) return;

    if (bytes.length > DEFAULT_MAX_FILE_SIZE) {
      importState.errorMessage = { title: 'File is too big' };
      app.model.args.metadataUploadHandle = undefined;
      return;
    }
    if (!processTableBytes(bytes)) {
      app.model.args.metadataUploadHandle = undefined;
    }
  }, { immediate: true });

  function openFileDialog() {
    fileDialogOpened.value = true;
  }

  async function handleFileSelected(files: ImportFileHandle[]) {
    if (files.length === 0) return;
    const file = files[0];

    try {
      // Attempt local file read - will throw for remote file handles
      const size = await platforma!.lsDriver.getLocalFileSize(file as never);
      if (size > DEFAULT_MAX_FILE_SIZE) {
        importState.errorMessage = { title: 'File is too big' };
        return;
      }
      const content = await platforma!.lsDriver.getLocalFileContent(file as never);
      processTableBytes(content);
    } catch {
      // Remote file - route through backend prerun
      app.model.args.metadataUploadHandle = file;
    }
  }

  function onImportClose() {
    clearImportCandidate();
    app.model.args.metadataUploadHandle = undefined;
  }

  return {
    importState,
    fileDialogOpened,
    openFileDialog,
    handleFileSelected,
    onImportClose,
    clearErrorMessage,
  };
}
