import type { BlockArgs, DSType } from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle, PlId } from '@platforma-sdk/model';
import { getFileNameFromHandle, uniquePlId } from '@platforma-sdk/model';
import type { AppV2, SimpleOption } from '@platforma-sdk/ui-vue';
import type { ComputedRef, Reactive, ShallowRef } from 'vue';
import { computed, ref, shallowRef, watch } from 'vue';
import type { FileContentType, FileNamePatternMatch } from './file_name_parser';
import { FileNamePattern } from './file_name_parser';

// Dataset import mode
export type ImportMode = 'create-new-dataset' | 'add-to-existing';

export const datasetTypes: Record<DSType, { label: string; fileType: FileContentType; hasTags: boolean }> = {
  Fastq: {
    label: 'FASTQ',
    fileType: 'Fastq',
    hasTags: false,
  },
  MultilaneFastq: {
    label: 'Multi-lane FASTQ',
    fileType: 'Fastq',
    hasTags: false,
  },
  TaggedFastq: {
    label: 'Tagged FASTQ',
    fileType: 'Fastq',
    hasTags: true,
  },
  Fasta: {
    label: 'FASTA',
    fileType: 'Fasta',
    hasTags: false,
  },
  Xsv: {
    label: 'Per sample CSV/TSV',
    fileType: 'Xsv',
    hasTags: false,
  },
  TaggedXsv: {
    label: 'Tagged per sample CSV/TSV',
    fileType: 'Xsv',
    hasTags: true,
  },
  CellRangerMTX: {
    label: 'CellRanger MTX',
    fileType: 'CellRangerMTX',
    hasTags: false,
  },
  BulkCountMatrix: {
    label: 'Bulk count matrix',
    fileType: 'Xsv',
    hasTags: false,
  },
};
export const datasetTypeOptions = Object.entries(datasetTypes).map(([value, { label }]) => ({
  value, label,
}));

export const datasetTypeLabels = datasetTypeOptions.reduce(
  (acc, { value, label }) => {
    acc[value] = label;
    return acc;
  },
  {} as Record<string, string>,
);

export const datasetTypeOptionsByFileType = (() => {
  const rec: Partial<Record<FileContentType, SimpleOption<DSType>[]>> = {};

  for (const [value, { label, fileType }] of Object.entries(datasetTypes)) {
    if (!rec[fileType]) {
      rec[fileType] = [];
    }
    rec[fileType].push({ value: value as DSType, label });
  }

  return rec;
})();

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

export function getOrCreateSample(appUt: unknown, sampleName: string): PlId {
  const app = appUt as AppV2<BlockArgs>;
  const id = Object.entries(app.model.args.sampleLabels).find(([, label]) => label === sampleName)?.[0];
  if (id) return id as PlId;
  const newId = uniquePlId();
  app.model.args.sampleIds.push(newId);
  app.model.args.sampleLabels[newId] = sampleName;
  return newId;
}
