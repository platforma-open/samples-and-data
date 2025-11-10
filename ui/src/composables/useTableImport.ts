import { reactive, type UnwrapRef } from 'vue';
import type { ImportResult } from '../dataimport';
import { readFileForImport } from '../dataimport';

export type TableImportState = {
  importCandidate: ImportResult | undefined;
  errorMessage: { title: string; message?: string } | undefined;
};

export type TableImportOptions = {
  title?: string;
  buttonLabel?: string;
  fileExtensions?: string[];
  maxFileSize?: number;
};

export function useTableImport(initialState?: Partial<TableImportState>) {
  const state = reactive<TableImportState>({
    importCandidate: undefined,
    errorMessage: undefined,
    ...initialState,
  });

  async function importTable(options: TableImportOptions = {}) {
    const {
      title = 'Import table',
      buttonLabel = 'Import',
      fileExtensions = ['xlsx', 'csv', 'tsv', 'txt'],
      maxFileSize = 5_000_000,
    } = options;

    const result = await platforma!.lsDriver.showOpenSingleFileDialog({
      title,
      buttonLabel,
      filters: [{ extensions: fileExtensions, name: 'Table data' }],
    });

    const file = result.file;
    if (!file) return;

    if ((await platforma!.lsDriver.getLocalFileSize(file)) > maxFileSize) {
      state.errorMessage = { title: 'File is too big' };
      return;
    }

    const content = await platforma!.lsDriver.getLocalFileContent(file);
    try {
      const ic = readFileForImport(content);
      if (ic.data.columns.length === 0 || ic.data.rows.length === 0) {
        state.errorMessage = { title: 'Table is empty', message: JSON.stringify(ic) };
        return;
      }
      state.importCandidate = ic;
    } catch (e) {
      state.errorMessage = {
        title: 'Error reading table',
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }

  function clearImportCandidate() {
    state.importCandidate = undefined;
  }

  function clearErrorMessage() {
    state.errorMessage = undefined;
  }

  return {
    state: state as UnwrapRef<TableImportState>,
    importTable,
    clearImportCandidate,
    clearErrorMessage,
  };
}
