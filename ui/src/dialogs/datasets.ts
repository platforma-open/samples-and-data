import type { BlockData, DSType } from "@platforma-open/milaboratories.samples-and-data.model";
import type { ImportFileHandle, PlId } from "@platforma-sdk/model";
import { getFilePathFromHandle, uniquePlId } from "@platforma-sdk/model";
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
  TaggedXsv: {
    label: "Tagged per sample CSV/TSV",
    fileType: "Xsv",
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

/** Windows handles carry `\`; patterns and prefix arithmetic assume `/`. */
export function toPosixPath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

/**
 * Longest directory prefix shared by every path, with a trailing `/`, or `""`
 * when they share no directory at all.
 *
 * The last segment of a path is its file name and is never part of the prefix,
 * so a single file — or a set of files all sitting in one folder — yields that
 * folder and leaves bare file names behind.
 */
export function commonDirPrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  const segments = paths.map((p) => p.split("/"));
  const maxDirs = Math.min(...segments.map((s) => s.length - 1));
  const first = segments[0];
  let shared = 0;
  while (shared < maxDirs && segments.every((s) => s[shared] === first[shared])) shared++;
  return shared === 0 ? "" : first.slice(0, shared).join("/") + "/";
}

/**
 * Paths of the given files relative to the folder they were imported from.
 *
 * Patterns are matched against these rather than against bare file names, so
 * `{{Sample}}` can be read out of a folder name in one-folder-per-sample
 * layouts. Recomputing the prefix over the whole set on every call — instead of
 * threading a root through the file dialog — keeps this well defined when the
 * selection spans folders or grows over several "add more files" rounds.
 */
export function relativeFilePaths(handles: ImportFileHandle[]): string[] {
  const paths = handles.map((h) => toPosixPath(getFilePathFromHandle(h)));
  const prefix = commonDirPrefix(paths);
  return paths.map((p) => p.slice(prefix.length));
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
  return computed<ParsedFile[]>(() => {
    const paths = relativeFilePaths(data.files);
    return data.files.map((handle, i) => {
      const fileName = paths[i];
      const match = compiledPattern.value?.match(fileName);
      return {
        handle,
        fileName,
        match,
      };
    });
  });
}

/**
 * The identity a matched file resolves to — everything the dataset content
 * builders key on when they place a handle. Two files sharing a key would
 * overwrite one another, keeping only whichever was processed last.
 */
export function sampleKeyOf(match: FileNamePatternMatch): string {
  const parts = [match.sample.value];
  if (match.lane) parts.push("lane=" + match.lane.value);
  if (match.readIndex) parts.push("read=" + match.readIndex.value);
  if (match.cellRangerFileRole) parts.push("role=" + match.cellRangerFileRole.value);
  for (const tag of Object.keys(match.tags ?? {}).sort())
    parts.push(`${tag}=${match.tags![tag].value}`);
  return parts.join("\u0000");
}

export type DuplicateKey = { sample: string; fileNames: string[] };

/** Groups of matched files that collapse onto one identity. Empty when fine. */
export function findDuplicateKeys(files: ParsedFile[]): DuplicateKey[] {
  const byKey = new Map<string, ParsedFile[]>();
  for (const f of files) {
    if (!f.match) continue;
    const key = sampleKeyOf(f.match);
    const group = byKey.get(key);
    if (group) group.push(f);
    else byKey.set(key, [f]);
  }
  return [...byKey.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      sample: group[0].match!.sample.value,
      fileNames: group.map((f) => f.fileName),
    }));
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
