import { reactive, type UnwrapRef } from "vue";
import type { ImportResult } from "../dataimport";

export type TableImportState = {
  importCandidate: ImportResult | undefined;
  errorMessage: { title: string; message?: string } | undefined;
};

export const DEFAULT_TABLE_FILE_EXTENSIONS = ["xlsx", "csv", "tsv", "txt"] as const;
export const DEFAULT_MAX_FILE_SIZE = 5_000_000;

export function useTableImport(initialState?: Partial<TableImportState>) {
  const state = reactive<TableImportState>({
    importCandidate: undefined,
    errorMessage: undefined,
    ...initialState,
  });

  function clearImportCandidate() {
    state.importCandidate = undefined;
  }

  function clearErrorMessage() {
    state.errorMessage = undefined;
  }

  return {
    state: state as UnwrapRef<TableImportState>,
    clearImportCandidate,
    clearErrorMessage,
  };
}
