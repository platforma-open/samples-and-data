<script setup lang="ts">
import type { MTColumn } from '@platforma-open/milaboratories.samples-and-data.model';
import type { ListOption } from '@platforma-sdk/ui-vue';
import {
  PlAlert,
  PlBtnPrimary,
  PlBtnSecondary,
  PlDialogModal,
  PlDropdown,
  PlLogView,
  PlTextArea,
} from '@platforma-sdk/ui-vue';
import { computed, reactive, watch } from 'vue';
import { useApp } from '../app';
import type { ImportResult } from '../dataimport';
import {
  columnNamesMatch,
  extractMetadataFromRow,
  processMetadataColumns,
} from '../utils/metadata';

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
  rows: Array<{
    fileId: string;
    sampleId: string;
    metadata: Record<string, unknown>;
    /** Per-tag barcode value pulled from the selected column for that tag. */
    barcodes: Record<string, string>;
  }>;
};

const app = useApp();

const data = reactive({
  fileIdColumnIdx: -1,
  sampleIdColumnIdx: -1,
  /** Map tagName -> selected column index. -1 = unset. */
  tagColumnIdx: {} as Record<string, number>,
});

watch(
  () => props.importCandidate,
  (ic) => {
    // file id
    data.fileIdColumnIdx = ic.data.columns.findIndex((c) =>
      c.header.toLowerCase().includes('file'));
    if (data.fileIdColumnIdx === -1) data.fileIdColumnIdx = 0;

    // sample id
    data.sampleIdColumnIdx = ic.data.columns.findIndex((c) =>
      c.header.toLowerCase().includes('sample'));
    if (data.sampleIdColumnIdx === -1) {
      data.sampleIdColumnIdx = data.fileIdColumnIdx === 0 ? 1 : 0;
    }
  },
  { immediate: true },
);

// Reset / repopulate tag→column mapping whenever the tag set changes.
watch(
  () => props.barcodeTags,
  (tags) => {
    const next: Record<string, number> = {};
    for (const tag of tags) {
      const found = props.importCandidate.data.columns.findIndex((c) =>
        c.header.toLowerCase().includes(tag.toLowerCase()));
      next[tag] = data.tagColumnIdx[tag] ?? found ?? -1;
    }
    data.tagColumnIdx = next;
  },
  { immediate: true },
);

const sampleColumnOptions = computed<ListOption<number>[]>(() =>
  props.importCandidate.data.columns.map((c, idx) => ({ value: idx, label: c.header })),
);

const skippedColumnIndices = computed(() => {
  const set = new Set<number>();
  set.add(data.fileIdColumnIdx);
  set.add(data.sampleIdColumnIdx);
  for (const tag of props.barcodeTags) {
    const idx = data.tagColumnIdx[tag];
    if (idx !== undefined && idx !== -1) set.add(idx);
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

  const matchedFiles = Array.from(uniqueFileIds).filter(
    (fileId) => props.availableGroupLabels.includes(fileId),
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
  let result = '';
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
    let result = '';
    if (ic.emptyColumns > 0) result += `Empty columns removed: ${ic.emptyColumns}\n`;
    if (ic.emptyRowsRemoved > 0) result += `Empty rows removed: ${ic.emptyRowsRemoved}\n`;
    if (ic.missingHeaders > 0) result += `Missing headers: ${ic.missingHeaders}\n`;
    return result;
  }
  return undefined;
});

const importDisabled = computed(() => {
  if (data.fileIdColumnIdx === -1 || data.sampleIdColumnIdx === -1) return true;
  if (props.barcodeTags.length === 0) return true;
  for (const tag of props.barcodeTags) {
    if ((data.tagColumnIdx[tag] ?? -1) === -1) return true;
  }
  return false;
});

function runImport() {
  const args = app.model.data;
  const rows: SamplesheetImportData['rows'] = [];

  const skipColumnIndices = Array.from(skippedColumnIndices.value);

  // Process metadata columns using utility function
  const { modelColumns, newColumns } = processMetadataColumns({
    importCandidate: props.importCandidate,
    existingMetadata: args.metadata,
    skipColumnIndices,
  });

  args.metadata.push(...newColumns);

  const metadataColumns = modelColumns.filter((col): col is MTColumn => col !== undefined);

  let lastFileId: string | null = null;

  for (const row of props.importCandidate.data.rows) {
    const fileIdValue = row[data.fileIdColumnIdx];
    const sampleIdValue = row[data.sampleIdColumnIdx];

    if (fileIdValue) lastFileId = String(fileIdValue);

    if (!sampleIdValue || !lastFileId) continue;

    const sampleId = String(sampleIdValue);
    const metadata = extractMetadataFromRow(row, modelColumns);

    const barcodes: Record<string, string> = {};
    for (const tag of props.barcodeTags) {
      const colIdx = data.tagColumnIdx[tag];
      const v = colIdx !== undefined && colIdx !== -1 ? row[colIdx] : undefined;
      barcodes[tag] = v !== undefined && v !== null ? String(v) : '';
    }

    rows.push({
      fileId: lastFileId,
      sampleId,
      metadata,
      barcodes,
    });
  }

  emit('onImport', {
    fileIdColumn: data.fileIdColumnIdx,
    sampleIdColumn: data.sampleIdColumnIdx,
    metadataColumns,
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

    <PlAlert v-if="props.barcodeTags.length === 0" type="warn">
      Declare at least one barcode tag in the Multiplexing Rules section
      before importing a samplesheet — the importer needs to know which
      column maps to which tag.
    </PlAlert>

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
    <PlDropdown
      v-for="tag in props.barcodeTags"
      :key="tag"
      :model-value="data.tagColumnIdx[tag] ?? -1"
      :label="`Barcode column for ${tag}`"
      :options="sampleColumnOptions"
      @update:model-value="(v) => (data.tagColumnIdx[tag] = v as number)"
    />

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
      <PlBtnPrimary :disabled="importDisabled" @click="runImport">
        Import
      </PlBtnPrimary>
      <PlBtnSecondary @click="() => emit('onClose')">Cancel</PlBtnSecondary>
    </template>
  </PlDialogModal>
</template>
