<script setup lang="ts">
import type { MTColumn, PlId } from '@platforma-open/milaboratories.samples-and-data.model';
import { uniquePlId } from '@platforma-sdk/model';
import type { ListOption } from '@platforma-sdk/ui-vue';
import {
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
    samplePlId: PlId;
    metadata: Record<string, unknown>;
  }>;
};

const app = useApp();

const data = reactive({
  fileIdColumnIdx: -1,
  sampleIdColumnIdx: -1,
  barcodeIdColumnIdx: -1,
});

watch(
  () => props.importCandidate,
  (ic) => {
    // Try to find file_id column
    data.fileIdColumnIdx = ic.data.columns.findIndex((c) =>
      c.header.toLowerCase().includes('file'));
    if (data.fileIdColumnIdx === -1) data.fileIdColumnIdx = 0;

    // Try to find sample_id column
    data.sampleIdColumnIdx = ic.data.columns.findIndex((c) =>
      c.header.toLowerCase().includes('sample'));
    if (data.sampleIdColumnIdx === -1) {
      // If sample column not found, try to use second column if different from file column
      data.sampleIdColumnIdx = data.fileIdColumnIdx === 0 ? 1 : 0;
    }

    // Try to find barcode_id column
    data.barcodeIdColumnIdx = ic.data.columns.findIndex((c) =>
      c.header.toLowerCase().includes('barcode'));
    // If not found, leave it as -1 (must be selected manually)
  },
  { immediate: true },
);

const sampleColumnOptions = computed<ListOption<number>[]>(() =>
  props.importCandidate.data.columns.map((c, idx) => ({ value: idx, label: c.header })),
);

// Count metadata columns (all columns except file ID, sample ID, and barcode ID)
const metadataColumnsCount = computed(() => {
  if (data.fileIdColumnIdx === -1 || data.sampleIdColumnIdx === -1 || data.barcodeIdColumnIdx === -1) {
    return 0;
  }
  return props.importCandidate.data.columns.length - 3; // Exclude file ID, sample ID, and barcode ID
});

const colsMatchingExisting = computed(() => {
  let res = 0;
  for (let cIdx = 0; cIdx < props.importCandidate.data.columns.length; cIdx++) {
    if (cIdx === data.fileIdColumnIdx || cIdx === data.sampleIdColumnIdx || cIdx === data.barcodeIdColumnIdx) continue;
    const c = props.importCandidate.data.columns[cIdx];
    if (app.model.args.metadata.find((mc) => columnNamesMatch(mc.label, c.header))) res++;
  }
  return res;
});

// Compute matching statistics based on selected file ID column
const matchingStats = computed(() => {
  if (data.fileIdColumnIdx === -1) {
    return { matchedFiles: 0, totalFiles: 0, unmatchedRows: 0 };
  }

  const uniqueFileIds = new Set<string>();
  let unmatchedRows = 0;
  let lastFileId: string | null = null;

  // Apply forward-fill logic for merged cells when collecting unique file IDs
  for (const row of props.importCandidate.data.rows) {
    const fileIdValue = row[data.fileIdColumnIdx];
    const sampleId = row[data.sampleIdColumnIdx];

    // Update lastFileId if current cell has a value
    if (fileIdValue) {
      lastFileId = String(fileIdValue);
    }

    // Skip rows without sample ID
    if (!sampleId) {
      unmatchedRows++;
      continue;
    }

    // If no file ID even after forward-fill, count as unmatched
    if (!lastFileId) {
      unmatchedRows++;
      continue;
    }

    uniqueFileIds.add(lastFileId);

    // Check if this file ID matches any group
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

function runImport() {
  const args = app.model.args;
  const rows: SamplesheetImportData['rows'] = [];

  // Process metadata columns using utility function
  const { modelColumns, newColumns } = processMetadataColumns({
    importCandidate: props.importCandidate,
    existingMetadata: args.metadata,
    skipColumnIndices: [data.fileIdColumnIdx, data.sampleIdColumnIdx, data.barcodeIdColumnIdx],
  });

  // Add new columns to the model
  args.metadata.push(...newColumns);

  // Get all metadata columns (existing + new)
  const metadataColumns = modelColumns.filter((col): col is MTColumn => col !== undefined);

  // Find or create "Barcode ID" metadata column
  let barcodeIdColumn = args.metadata.find((col) => col.label === 'Barcode ID');
  if (!barcodeIdColumn) {
    barcodeIdColumn = {
      id: uniquePlId(),
      label: 'Barcode ID',
      valueType: 'String',
      global: true,
      data: {},
    };
    args.metadata.push(barcodeIdColumn);
    metadataColumns.push(barcodeIdColumn);
  } else if (!metadataColumns.includes(barcodeIdColumn)) {
    // Add barcode ID column to metadata columns list if it already existed
    metadataColumns.push(barcodeIdColumn);
  }

  // Process rows with forward-fill for merged cells
  let lastFileId: string | null = null;

  for (const row of props.importCandidate.data.rows) {
    const fileIdValue = row[data.fileIdColumnIdx];
    const sampleIdValue = row[data.sampleIdColumnIdx];
    const barcodeIdValue = row[data.barcodeIdColumnIdx];

    // Update lastFileId if current cell has a value
    if (fileIdValue) {
      lastFileId = String(fileIdValue);
    }

    // Skip row if no sample ID or no file ID (even after forward-fill)
    if (!sampleIdValue || !lastFileId) continue;

    const sampleId = String(sampleIdValue);
    const samplePlId = uniquePlId();

    // Extract metadata using utility function
    const metadata = extractMetadataFromRow(row, modelColumns);

    // Add barcode ID to metadata if present
    if (barcodeIdValue) {
      metadata[barcodeIdColumn.id] = String(barcodeIdValue);
    }

    rows.push({
      fileId: lastFileId,
      sampleId: sampleId,
      samplePlId: samplePlId,
      metadata: metadata,
    });
  }

  emit('onImport', {
    fileIdColumn: data.fileIdColumnIdx,
    sampleIdColumn: data.sampleIdColumnIdx,
    metadataColumns: metadataColumns,
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
    <PlDropdown
      v-model="data.barcodeIdColumnIdx"
      label="Barcode ID column"
      :options="sampleColumnOptions"
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
      <PlBtnPrimary
        :disabled="data.fileIdColumnIdx === -1 || data.sampleIdColumnIdx === -1 || data.barcodeIdColumnIdx === -1"
        @click="runImport"
      >
        Import
      </PlBtnPrimary>
      <PlBtnSecondary @click="() => emit('onClose')">Cancel</PlBtnSecondary>
    </template>
  </PlDialogModal>
</template>
