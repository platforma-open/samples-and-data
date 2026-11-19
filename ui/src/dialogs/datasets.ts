import type { BlockData, DSType } from "@platforma-open/milaboratories.samples-and-data.model";
import type { ImportFileHandle, PlId } from "@platforma-sdk/model";
import { getFileNameFromHandle, uniquePlId } from "@platforma-sdk/model";
import type { AppV3, SimpleOption } from "@platforma-sdk/ui-vue";
import type { ComputedRef, Reactive, ShallowRef } from "vue";
import { computed, ref, shallowRef, watch } from "vue";
import type { FileContentType, FileNamePatternMatch } from "./file_name_parser";
import { FileNamePattern } from "./file_name_parser";

// Dataset import mode
export type ImportMode = "create-new-dataset" | "add-to-existing";

export const datasetTypes: Record<
  DSType,
  { label: string; fileType: FileContentType; hasTags: boolean }
> = {
  Fastq: {
    label: "FASTQ",
    fileType: "Fastq",
    hasTags: false,
  },
  MultilaneFastq: {
    label: "Multi-lane FASTQ",
    fileType: "Fastq",
    hasTags: false,
  },
  MultiplexedFastq: {
    label: "Multiplexed FASTQ",
    fileType: "Fastq",
    hasTags: false,
  },
  TaggedFastq: {
    label: "Tagged FASTQ",
    fileType: "Fastq",
    hasTags: true,
  },
  Fasta: {
    label: "FASTA",
    fileType: "Fasta",
    hasTags: false,
  },
  Xsv: {
    label: "Per sample CSV/TSV",
    fileType: "Xsv",
    hasTags: false,
  },
  MultiSampleXsv: {
    label: "Multisample CSV/TSV",
    fileType: "Xsv",
    hasTags: false,
  },
  TaggedXsv: {
    label: "Tagged per sample CSV/TSV",
    fileType: "Xsv",
    hasTags: true,
  },
  TaggedAb1: {
    label: "Tagged Sanger AB1",
    fileType: "Ab1",
    hasTags: true,
  },
  CellRangerMTX: {
    label: "CellRanger MTX",
    fileType: "CellRangerMTX",
    hasTags: false,
  },
  H5AD: {
    label: "H5AD",
    fileType: "H5AD",
    hasTags: false,
  },
  H5: {
    label: "H5",
    fileType: "H5",
    hasTags: false,
  },
  Seurat: {
    label: "Seurat RDS",
    fileType: "Seurat",
    hasTags: false,
  },
  MultiSampleH5AD: {
    label: "Multisample H5AD",
    fileType: "H5AD",
    hasTags: false,
  },
  MultiSampleSeurat: {
    label: "Multisample Seurat RDS",
    fileType: "Seurat",
    hasTags: false,
  },
  BulkCountMatrix: {
    label: "Bulk count matrix",
    fileType: "Xsv",
    hasTags: false,
  },
};
export const datasetTypeOptions = Object.entries(datasetTypes).map(([value, { label }]) => ({
  value,
  label,
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
    value: "create-new-dataset",
    text: "Create new dataset",
  },
  {
    value: "add-to-existing",
    text: "Add to existing dataset",
  },
];

export function extractFileName(filePath: string) {
  return filePath.replace(/^.*[\\/]/, "");
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
  const app = appUt as AppV3<BlockData>;
  const id = Object.entries(app.model.data.sampleLabels).find(
    ([, label]) => label === sampleName,
  )?.[0];
  if (id) return id as PlId;
  const newId = uniquePlId();
  app.model.data.sampleIds.push(newId);
  app.model.data.sampleLabels[newId] = sampleName;
  return newId;
}

/** group id -> sample id -> the sample's value in that group's file */
type SampleGroups = Record<PlId, Record<PlId, string>>;

/**
 * Sample labels per file (one file per group) of a Multisample CSV/TSV dataset.
 * A value found in one file only keeps its name; a value found in several files
 * gets the file's label added, so each file has its own sample.
 */
export function multiSampleXsvLabels(
  valuesPerGroup: Record<PlId, string[]>,
  groupLabels: Record<PlId, string>,
): Record<PlId, Record<string, string>> {
  // value -> number of files it is found in
  const nGroups = new Map<string, number>();
  for (const values of Object.values(valuesPerGroup))
    for (const value of new Set(values)) nGroups.set(value, (nGroups.get(value) ?? 0) + 1);
  const result: Record<PlId, Record<string, string>> = {};
  for (const [groupId, values] of Object.entries(valuesPerGroup) as [PlId, string[]][]) {
    const labels: Record<string, string> = {};
    for (const value of values) {
      labels[value] =
        (nGroups.get(value) ?? 0) > 1 ? `${value} (${groupLabels[groupId] ?? groupId})` : value;
    }
    result[groupId] = labels;
  }
  // group id -> value -> sample label
  return result;
}

/**
 * Handle sample labels in new `sampleGroups` of a Multisample CSV/TSV dataset.
 * A value that already has a sample in its file keeps it; any other value gets
 * the sample labelled by `multiSampleXsvLabels`, created if missing.
 *
 * Example, nothing imported yet, group labels { g1: "pool1", g2: "pool2" }:
 *   { g1: ["S1", "S3"], g2: ["S3"] }
 *   -> { g1: { s1: "S1", s2: "S3" }, g2: { s3: "S3" } }
 *   new samples s1, s2, s3 labelled "S1", "S3 (pool1)", "S3 (pool2)"
 */
export function assignMultiSampleXsvSamples(
  valuesPerGroup: Record<PlId, string[]>,
  groupLabels: Record<PlId, string>,
  current: SampleGroups | undefined,
  sampleForLabel: (label: string) => PlId,
): SampleGroups {
  const labels = multiSampleXsvLabels(valuesPerGroup, groupLabels);

  const result: SampleGroups = {};
  for (const [groupId, values] of Object.entries(valuesPerGroup) as [PlId, string[]][]) {
    // value -> the sample it already has in this file
    const kept = new Map(
      Object.entries(current?.[groupId] ?? {}).map(([sampleId, value]) => [
        value,
        sampleId as PlId,
      ]),
    );
    const mapping: Record<PlId, string> = {};
    for (const value of values) {
      const sampleId = kept.get(value) ?? sampleForLabel(labels[groupId][value]);
      mapping[sampleId] = value;
    }
    result[groupId] = mapping;
  }
  // group id -> sample id -> the value as written in that group's file
  return result;
}
