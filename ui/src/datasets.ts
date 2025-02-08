import type { Ref, ShallowRef } from "vue";
import { Reactive, ref, shallowRef, watch, computed } from "vue";
import { FileNamePattern } from "./file_name_parser";
import { ParsedFile } from "./types";
import { getFileNameFromHandle, ImportFileHandle } from "@platforma-sdk/model";
import { BlockArgs, DatasetAny, uniquePlId, PlId } from "@platforma-open/milaboratories.samples-and-data.model";
import { SimpleOption } from "@platforma-sdk/ui-vue";

// Dataset import mode
export type ImportMode = 'create-new-dataset' | 'add-to-existing';

export const readIndicesOptions: SimpleOption<string>[] = [
  {
    value: JSON.stringify(['R1']),
    text: 'R1'
  },
  {
    value: JSON.stringify(['R1', 'R2']),
    text: 'R1, R2'
  },
  {
    value: JSON.stringify([]),
    text: 'fasta'
  }
];

export const modesOptions: SimpleOption<ImportMode>[] = [
  {
    value: 'create-new-dataset',
    text: 'Create new dataset'
  },
  {
    value: 'add-to-existing',
    text: 'Add to existing dataset'
  }
];

export function extractFileName(filePath: string) {
  return filePath.replace(/^.*[\\/]/, '');
}

export function getDsReadIndices(ds: DatasetAny): string[] {
  const c = ds.content;
  switch (c.type) {
    case 'Fastq':
    case 'MultilaneFastq':
    case 'TaggedFastq':
      return c.readIndices;
    case 'Fasta':
      return [];
  }
}

// Pattern compilation and file name matching
export function usePatternCompilation(data: Reactive<{pattern: string}>) {
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
      } catch (err: any) {
        compiledPattern.value = undefined;
        patternError.value = err.message;
      }
    },
    { immediate: true }
  );

  return { patternError, compiledPattern };
}

export function useParsedFiles(data: Reactive<{files: ImportFileHandle[]}>, compiledPattern: ShallowRef<FileNamePattern | undefined>) {
  return computed<ParsedFile[]>(() =>
    data.files.map((handle) => {
      const fileName = extractFileName(getFileNameFromHandle(handle));
      const match = compiledPattern.value?.match(fileName);
      return {
        handle,
        fileName,
        match
      };
    })
  );
}

export function createGetOrCreateSample(args: BlockArgs) {
  return (sampleName: string) => {
    const id = Object.entries(args.sampleLabels).find(([, label]) => label === sampleName)?.[0];
    if (id) return id as PlId;
    const newId = uniquePlId();
    args.sampleIds.push(newId);
    args.sampleLabels[newId] = sampleName;
    return newId;
  };
}