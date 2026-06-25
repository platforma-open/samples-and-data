<script setup lang="ts">
import type { MTColumn } from "@platforma-open/milaboratories.samples-and-data.model";
import type { ListOption } from "@platforma-sdk/ui-vue";
import {
  PlAlert,
  PlBtnGhost,
  PlBtnPrimary,
  PlBtnSecondary,
  PlDialogModal,
  PlDropdown,
  PlLogView,
  PlRow,
  PlTextArea,
  PlTextField,
} from "@platforma-sdk/ui-vue";
import { computed, reactive, watch } from "vue";
import { useApp } from "../app";
import type { ImportResult } from "../dataimport";
import {
  columnNamesMatch,
  extractMetadataFromRow,
  processMetadataColumns,
} from "../utils/metadata";
import {
  defaultBindingsFor,
  deriveTagName,
  FALLBACK_TAG_NAME,
  TAG_NAME_RX,
  type TagBinding,
} from "../utils/samplesheet-bindings";

const props = defineProps<{
  importCandidate: ImportResult;
  availableGroupLabels: string[];
  /** Declared barcode tags on the target multiplexed-FASTQ dataset. */
  barcodeTags: string[];
}>();

const emit = defineEmits<{
  onClose: [];
  onImport: [data: SamplesheetImportData];
}>();

export type SamplesheetImportData = {
  fileIdColumn: number;
  sampleIdColumn: number;
  metadataColumns: MTColumn[];
  /**
   * Tags the importer wants the dataset to declare. Includes both pre-existing
   * tags (echoed back) and brand-new ones the operator added in the dialog.
   * Caller is responsible for merging into `dataset.content.barcodeTags`.
   */
  declaredTags: string[];
  rows: Array<{
    fileId: string;
    sampleId: string;
    metadata: Record<string, unknown>;
    /** Per-tag barcode value pulled from the selected column for that tag. */
    barcodes: Record<string, string>;
  }>;
};

const app = useApp();

// Stable per-row id for Vue keys — index keys bleed input state on mid-list
// removal; tagName can't be the key (user-edited, may be empty/duplicate).
type BoundTag = TagBinding & { id: string };
let bindingIdSeq = 0;
const withId = (b: TagBinding): BoundTag => ({ ...b, id: `bind-${bindingIdSeq++}` });

const data = reactive({
  fileIdColumnIdx: -1,
  sampleIdColumnIdx: -1,
  bindings: [] as BoundTag[],
});

watch(
  () => props.importCandidate,
  (ic) => {
    // file id
    data.fileIdColumnIdx = ic.data.columns.findIndex((c) =>
      c.header.toLowerCase().includes("file"),
    );
    if (data.fileIdColumnIdx === -1) data.fileIdColumnIdx = 0;

    // sample id
    data.sampleIdColumnIdx = ic.data.columns.findIndex((c) =>
      c.header.toLowerCase().includes("sample"),
    );
    if (data.sampleIdColumnIdx === -1) {
      data.sampleIdColumnIdx = data.fileIdColumnIdx === 0 ? 1 : 0;
    }

    data.bindings = defaultBindingsFor(
      ic,
      data.fileIdColumnIdx,
      data.sampleIdColumnIdx,
      props.barcodeTags,
    ).map(withId);
  },
  { immediate: true },
);

// When dataset's declared tag set changes externally, re-seed bindings
// (preserving any existing column choices the operator made).
watch(
  () => props.barcodeTags,
  (tags) => {
    const previous = new Map(data.bindings.map((b) => [b.tagName, b.columnIdx]));
    const seeded = defaultBindingsFor(
      props.importCandidate,
      data.fileIdColumnIdx,
      data.sampleIdColumnIdx,
      tags,
    );
    data.bindings = seeded.map((b) =>
      withId({ ...b, columnIdx: previous.get(b.tagName) ?? b.columnIdx }),
    );
  },
);

const sampleColumnOptions = computed<ListOption<number>[]>(() =>
  props.importCandidate.data.columns.map((c, idx) => ({ value: idx, label: c.header })),
);

const skippedColumnIndices = computed(() => {
  const set = new Set<number>();
  set.add(data.fileIdColumnIdx);
  set.add(data.sampleIdColumnIdx);
  for (const b of data.bindings) {
    if (b.columnIdx !== -1) set.add(b.columnIdx);
  }
  return set;
});

const metadataColumnsCount = computed(() => {
  if (data.fileIdColumnIdx === -1 || data.sampleIdColumnIdx === -1) return 0;
  return props.importCandidate.data.columns.length - skippedColumnIndices.value.size;
});

const colsMatchingExisting = computed(() => {
  let res = 0;
  const skip = skippedColumnIndices.value;
  for (let cIdx = 0; cIdx < props.importCandidate.data.columns.length; cIdx++) {
    if (skip.has(cIdx)) continue;
    const c = props.importCandidate.data.columns[cIdx];
    if (app.model.data.metadata.find((mc) => columnNamesMatch(mc.label, c.header))) res++;
  }
  return res;
});

const matchingStats = computed(() => {
  if (data.fileIdColumnIdx === -1) {
    return { matchedFiles: 0, totalFiles: 0, unmatchedRows: 0 };
  }

  const uniqueFileIds = new Set<string>();
  let unmatchedRows = 0;
  let lastFileId: string | null = null;

  for (const row of props.importCandidate.data.rows) {
    const fileIdValue = row[data.fileIdColumnIdx];
    const sampleId = row[data.sampleIdColumnIdx];

    if (fileIdValue) lastFileId = String(fileIdValue);

    if (!sampleId) {
      unmatchedRows++;
      continue;
    }

    if (!lastFileId) {
      unmatchedRows++;
      continue;
    }

    uniqueFileIds.add(lastFileId);

    if (!props.availableGroupLabels.includes(lastFileId)) {
      unmatchedRows++;
    }
  }

  const matchedFiles = Array.from(uniqueFileIds).filter((fileId) =>
    props.availableGroupLabels.includes(fileId),
  ).length;

  return {
    matchedFiles,
    totalFiles: uniqueFileIds.size,
    unmatchedRows,
  };
});

const tableDataText = computed(() => {
  const ic = props.importCandidate;
  const stats = matchingStats.value;
  let result = "";
  result += `Total rows: ${ic.data.rows.length}\n`;
  result += `Columns: ${ic.data.columns.length}\n`;
  result += `Matched files: ${stats.matchedFiles} (out of ${stats.totalFiles})`;
  if (stats.unmatchedRows > 0) {
    result += `\nUnmatched rows: ${stats.unmatchedRows}`;
  }
  if (metadataColumnsCount.value > 0) {
    result += `\nMetadata columns: ${metadataColumnsCount.value} (${colsMatchingExisting.value} match existing)`;
  }
  return result;
});

const tableIssuesText = computed(() => {
  const ic = props.importCandidate;
  if (ic.emptyColumns > 0 || ic.emptyRowsRemoved > 0 || ic.missingHeaders > 0) {
    let result = "";
    if (ic.emptyColumns > 0) result += `Empty columns removed: ${ic.emptyColumns}\n`;
    if (ic.emptyRowsRemoved > 0) result += `Empty rows removed: ${ic.emptyRowsRemoved}\n`;
    if (ic.missingHeaders > 0) result += `Missing headers: ${ic.missingHeaders}\n`;
    return result;
  }
  return undefined;
});

// Columns selectable as a barcode source — everything except the File ID and
// Sample ID columns.
const bindingColumnOptions = computed<ListOption<number>[]>(() =>
  props.importCandidate.data.columns
    .map((c, idx) => ({ value: idx, label: c.header }))
    .filter((o) => o.value !== data.fileIdColumnIdx && o.value !== data.sampleIdColumnIdx),
);

// First column not already used as File ID / Sample ID / another binding, or
// -1 when every column is taken (the "Add barcode tag" button disables then).
const availableColumnForNewBinding = computed<number>(() => {
  const used = new Set<number>([data.fileIdColumnIdx, data.sampleIdColumnIdx]);
  for (const b of data.bindings) used.add(b.columnIdx);
  for (let i = 0; i < props.importCandidate.data.columns.length; i++) {
    if (!used.has(i)) return i;
  }
  return -1;
});

// Column-selection errors — surfaced under the column dropdown.
function bindingColumnError(idx: number): string | undefined {
  const b = data.bindings[idx];
  if (b.columnIdx === -1) return "Select a barcode column";
  if (b.columnIdx === data.fileIdColumnIdx || b.columnIdx === data.sampleIdColumnIdx) {
    return "Column is already used as File ID / Sample ID";
  }
  if (data.bindings.some((other, i) => i !== idx && other.columnIdx === b.columnIdx)) {
    return "Each column can map to only one tag";
  }
  return undefined;
}

// Tag-name errors — surfaced under the tag-name field.
function bindingTagError(idx: number): string | undefined {
  const b = data.bindings[idx];
  if (!b.tagName) return "Tag name is required";
  if (!TAG_NAME_RX.test(b.tagName)) return "Use letters and digits only";
  if (data.bindings.some((other, i) => i !== idx && other.tagName === b.tagName)) {
    return "Tag name must be unique";
  }
  return undefined;
}

const importDisabled = computed(() => {
  if (data.fileIdColumnIdx === -1 || data.sampleIdColumnIdx === -1) return true;
  for (let i = 0; i < data.bindings.length; i++) {
    if (bindingColumnError(i) || bindingTagError(i)) return true;
  }
  return false;
});

function addBinding() {
  const columnIdx = availableColumnForNewBinding.value;
  if (columnIdx === -1) return;
  const header = props.importCandidate.data.columns[columnIdx]?.header ?? "";
  // Seed a candidate tag name from the header, de-duplicated against existing
  // bindings; the operator can rename it before importing.
  const base = deriveTagName(header) || FALLBACK_TAG_NAME;
  const existing = new Set(data.bindings.map((b) => b.tagName));
  let tagName = base;
  let n = 2;
  while (existing.has(tagName)) {
    tagName = `${base}${n}`;
    n++;
  }
  data.bindings = [...data.bindings, withId({ tagName, columnIdx })];
}

function removeBinding(idx: number) {
  data.bindings = data.bindings.filter((_, i) => i !== idx);
}

function updateBindingTag(idx: number, value: string) {
  data.bindings = data.bindings.map((b, i) => (i === idx ? { ...b, tagName: value } : b));
}

function updateBindingColumn(idx: number, value: number) {
  data.bindings = data.bindings.map((b, i) => (i === idx ? { ...b, columnIdx: value } : b));
}

function runImport() {
  const args = app.model.data;
  const rows: SamplesheetImportData["rows"] = [];

  const skipColumnIndices = Array.from(skippedColumnIndices.value);

  const { modelColumns, newColumns } = processMetadataColumns({
    importCandidate: props.importCandidate,
    existingMetadata: args.metadata,
    skipColumnIndices,
  });

  args.metadata.push(...newColumns);

  const metadataColumns = modelColumns.filter((col): col is MTColumn => col !== undefined);

  const declaredTags = data.bindings.map((b) => b.tagName);

  let lastFileId: string | null = null;

  for (const row of props.importCandidate.data.rows) {
    const fileIdValue = row[data.fileIdColumnIdx];
    const sampleIdValue = row[data.sampleIdColumnIdx];

    if (fileIdValue) lastFileId = String(fileIdValue);

    if (!sampleIdValue || !lastFileId) continue;

    const sampleId = String(sampleIdValue);
    const metadata = extractMetadataFromRow(row, modelColumns);

    const barcodes: Record<string, string> = {};
    for (const b of data.bindings) {
      const v = b.columnIdx !== -1 ? row[b.columnIdx] : undefined;
      barcodes[b.tagName] = v !== undefined && v !== null ? String(v) : "";
    }

    rows.push({
      fileId: lastFileId,
      sampleId,
      metadata,
      barcodes,
    });
  }

  emit("onImport", {
    fileIdColumn: data.fileIdColumnIdx,
    sampleIdColumn: data.sampleIdColumnIdx,
    metadataColumns,
    declaredTags,
    rows,
  });
}
</script>

<template>
  <PlDialogModal
    :model-value="true"
    :close-on-outside-click="false"
    closable
    width="70%"
    @update:model-value="
      (v) => {
        if (!v) emit('onClose');
      }
    "
  >
    <template #title>Import samplesheet</template>

    <PlDropdown
      v-model="data.fileIdColumnIdx"
      label="File ID column"
      :options="sampleColumnOptions"
    />
    <PlDropdown
      v-model="data.sampleIdColumnIdx"
      label="Sample ID column"
      :options="sampleColumnOptions"
    />

    <PlAlert v-if="data.bindings.length === 0" type="info">
      No barcode columns will be imported — remaining columns will flow to metadata. Use
      <strong>Add barcode tag</strong> to map columns to tags.
    </PlAlert>

    <PlRow v-for="(binding, idx) in data.bindings" :key="binding.id">
      <PlDropdown
        :model-value="binding.columnIdx"
        label="Barcode column"
        :options="bindingColumnOptions"
        :error="bindingColumnError(idx)"
        @update:model-value="
          (v: number | undefined) => v !== undefined && updateBindingColumn(idx, v)
        "
      />
      <PlTextField
        :model-value="binding.tagName"
        label="Tag name"
        placeholder="e.g. Master"
        :error="bindingTagError(idx)"
        @update:model-value="(v: string) => updateBindingTag(idx, v)"
      />
      <PlBtnGhost icon="close" @click="removeBinding(idx)" />
    </PlRow>

    <PlBtnSecondary icon="add" :disabled="availableColumnForNewBinding === -1" @click="addBinding">
      Add barcode tag
    </PlBtnSecondary>

    <PlLogView :value="tableDataText" label="Import information" />
    <template v-if="tableIssuesText">
      <PlTextArea
        :model-value="tableIssuesText"
        label="File issues"
        readonly
        :autogrow="true"
        :rows="1"
      />
    </template>

    <template #actions>
      <PlBtnPrimary :disabled="importDisabled" @click="runImport"> Import </PlBtnPrimary>
      <PlBtnSecondary @click="() => emit('onClose')">Cancel</PlBtnSecondary>
    </template>
  </PlDialogModal>
</template>
