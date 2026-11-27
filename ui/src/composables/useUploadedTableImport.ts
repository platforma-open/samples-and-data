import type { BlobHandleAndSize, ImportFileHandle } from "@platforma-sdk/model";
import { getFileNameFromHandle } from "@platforma-sdk/model";
import { ReactiveFileContent } from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { readFileForImport } from "../dataimport";
import { DEFAULT_MAX_FILE_SIZE, useTableImport } from "./useTableImport";

/**
 * Where an uploaded table lives: the handle the user picked (stored in block
 * data and imported by the prerun), and the prerun's exported file for it.
 */
export type UploadedTableSource = {
  getHandle: () => ImportFileHandle | undefined;
  setHandle: (handle: ImportFileHandle | undefined) => void;
  getFile: () => BlobHandleAndSize | undefined;
};

/**
 * Table import through `PlFileDialog`, so the file may come from any storage
 * the dialog offers (local or remote). The prerun imports the picked handle;
 * its content is read here from the exported file.
 */
export function useUploadedTableImport(source: UploadedTableSource) {
  const reactiveFileContent = ReactiveFileContent.useGlobal();
  const { state: importState, clearImportCandidate, clearErrorMessage } = useTableImport();

  const fileDialogOpened = ref(false);

  const fileTooBig = computed(() => {
    const file = source.getFile();
    return file !== undefined && file.size > DEFAULT_MAX_FILE_SIZE;
  });

  // Content is requested only for a file within the size limit.
  const fileBytes = computed(() => {
    const file = source.getFile();
    if (!file || fileTooBig.value) return undefined;
    return reactiveFileContent.getContentBytes(file.handle).value;
  });

  // Parse bytes and populate importState. Returns true on success, false on failure.
  function processTableBytes(bytes: Uint8Array, fileName: string): boolean {
    try {
      const ic = readFileForImport(bytes, fileName);
      if (ic.data.columns.length === 0 || ic.data.rows.length === 0) {
        importState.errorMessage = {
          title: "Table is empty",
          message: "The file does not contain any data to import.",
        };
        return false;
      }
      importState.importCandidate = ic;
      return true;
    } catch (e) {
      importState.errorMessage = {
        title: "Error reading table",
        message: e instanceof Error ? e.message : String(e),
      };
      return false;
    }
  }

  watch(
    [fileTooBig, fileBytes],
    ([tooBig, bytes]) => {
      const handle = source.getHandle();
      if (handle === undefined) return;
      if (importState.importCandidate !== undefined) return;

      // The byte-length check backs up the exported size.
      if (tooBig || (bytes !== undefined && bytes.length > DEFAULT_MAX_FILE_SIZE)) {
        importState.errorMessage = { title: "File is too big" };
        source.setHandle(undefined);
        return;
      }
      if (bytes === undefined) return;
      if (!processTableBytes(bytes, getFileNameFromHandle(handle))) {
        source.setHandle(undefined);
      }
    },
    { immediate: true },
  );

  function openFileDialog() {
    fileDialogOpened.value = true;
  }

  function handleFileSelected(files: ImportFileHandle[]) {
    if (files.length === 0) return;
    source.setHandle(files[0]);
  }

  function onImportClose() {
    clearImportCandidate();
    source.setHandle(undefined);
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
