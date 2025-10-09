import type { ImportFileHandle } from '@platforma-sdk/model';
import { getFileNameFromHandle } from '@platforma-sdk/model';
import type { SimpleOption } from '@platforma-sdk/ui-vue';
import type { ComputedRef, Reactive, ShallowRef } from 'vue';
import { computed, ref, shallowRef, watch } from 'vue';
import type { FileNamePatternMatch } from './file_name_parser';
import { FileNamePattern } from './file_name_parser';

// Dataset import mode
export type ImportMode = 'create-new-dataset' | 'add-to-existing';

export const datasetTypeOptions = [
  {
    value: 'Fastq', label: 'FASTQ',
  },
  {
    value: 'Fasta', label: 'FASTA',
  },
  {
    value: 'MultilaneFastq', label: 'Multi-lane FASTQ',
  },
  {
    value: 'TaggedFastq', label: 'Tagged FASTQ',
  },
  {
    value: 'Xsv', label: 'XSV',
  },
  {
    value: 'TaggedXsv', label: 'Tagged XSV',
  },
];

export const datasetTypeLabels = datasetTypeOptions.reduce(
  (acc, { value, label }) => {
    acc[value] = label;
    return acc;
  },
  {} as Record<string, string>,
);

export const modesOptions: SimpleOption<ImportMode>[] = [
  {
    value: 'create-new-dataset',
    text: 'Create new dataset',
  },
  {
    value: 'add-to-existing',
    text: 'Add to existing dataset',
  },
];

export function extractFileName(filePath: string) {
  return filePath.replace(/^.*[\\/]/, '');
}

// Pattern compilation and file name matching
export function usePatternCompilation(data: Reactive<{ pattern: string }>) {
  const patternError = ref<string | undefined>(undefined);
  const compiledPattern = shallowRef<FileNamePattern | undefined>(undefined);

  watch(
    () => data.pattern,
    (p) => {
      if (!p) {
        compiledPattern.value = undefined;
        patternError.value = undefined;
        return;
      }

      try {
        compiledPattern.value = FileNamePattern.parse(p);
        patternError.value = undefined;
      } catch (err) {
        compiledPattern.value = undefined;
        patternError.value = err instanceof Error ? err.message : String(err);
      }
    },
    { immediate: true },
  );

  return { patternError, compiledPattern };
}

export type ParsedFile = {
  handle: ImportFileHandle;
  fileName: string;
  match?: FileNamePatternMatch;
};

export function useParsedFiles(
  data: Reactive<{ files: ImportFileHandle[] }>,
  compiledPattern: ShallowRef<FileNamePattern | undefined>,
): ComputedRef<ParsedFile[]> {
  return computed<ParsedFile[]>(() =>
    data.files.map((handle) => {
      const fileName = extractFileName(getFileNameFromHandle(handle));
      const match = compiledPattern.value?.match(fileName);
      return {
        handle,
        fileName,
        match,
      };
    }),
  );
}
