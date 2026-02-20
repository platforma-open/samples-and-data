<script setup lang="ts">
import type { Dataset, DSContent, DSMultiplexedFastq, PlId, WithSampleGroupsData } from '@platforma-open/milaboratories.samples-and-data.model';
import { PlAlert, PlBtnPrimary, PlProgressCell, ReactiveFileContent } from '@platforma-sdk/ui-vue';
import * as _ from 'radashi';
import { computed } from 'vue';
import { useApp } from '../app';
import ImportErrorDialog from '../components/ImportErrorDialog.vue';
import { useTableImport } from '../composables/useTableImport';
import { parseCsvNestedMapFromHandles, setEquals } from '../util';
import { getOrCreateSample } from './datasets';
import type { SamplesheetImportData } from './ImportSamplesheetDialog.vue';
import ImportSamplesheetDialog from './ImportSamplesheetDialog.vue';

const app = useApp();
const reactiveFileContent = ReactiveFileContent.useGlobal();

const props = defineProps<{
  datasetIds: PlId[];
}>();

// Helper type for grouped datasets with type property
type GroupedDataset = Dataset<DSContent & WithSampleGroupsData<unknown>>;

const datasets = computed(() => {
  return props.datasetIds.map((datasetId) => {
    const ds = app.model.data.datasets.find((ds) => ds.id === datasetId);
    if (!ds)
      throw new Error('Dataset not found');
    return ds as GroupedDataset;
  });
});

// Check if any dataset is MultiplexedFastq (requires samplesheet import)
const multiplexedFastqDatasets = computed(() =>
  datasets.value.filter((ds) => ds.content.type === 'MultiplexedFastq') as DSMultiplexedFastq[],
);

// Datasets that support auto-extraction (BulkCountMatrix, MultiSampleH5AD, MultiSampleSeurat)
const autoExtractDatasets = computed(() =>
  datasets.value.filter((ds) =>
    ['BulkCountMatrix', 'MultiSampleH5AD', 'MultiSampleSeurat'].includes(ds.content.type),
  ),
);

// Samplesheet import logic
const { state: importState, importTable, clearImportCandidate, clearErrorMessage } = useTableImport();

async function importSamplesheet() {
  await importTable({
    title: 'Import samplesheet',
    buttonLabel: 'Import',
    fileExtensions: ['xlsx'],
  });
}

async function handleSamplesheetImport(importData: SamplesheetImportData) {
  const args = app.model.data;

  // Create metadata columns lookup map for O(1) access
  const metadataColumnsMap = new Map(importData.metadataColumns.map((col) => [col.id, col]));

  for (const dataset of multiplexedFastqDatasets.value) {
    // Create group label to groupId lookup map for O(1) access
    const groupLabelToId = new Map(
      Object.entries(dataset.content.groupLabels).map(([groupId, label]) => [label, groupId as PlId]),
    );

    // Clone the existing sampleGroups to trigger Vue reactivity
    const updatedSampleGroups = { ...(dataset.content.sampleGroups || {}) };

    // Process each row and match fileId to groupLabel
    for (const row of importData.rows) {
      // Find the group that matches this fileId using lookup map
      const groupId = groupLabelToId.get(row.fileId);
      if (!groupId) {
        continue;
      }

      // Clone the group's sample mapping
      if (!updatedSampleGroups[groupId]) {
        updatedSampleGroups[groupId] = {};
      } else {
        updatedSampleGroups[groupId] = { ...updatedSampleGroups[groupId] };
      }

      // Use the samplePlId from import data
      const sampleId = row.samplePlId;

      // Add sample to global sample lists
      args.sampleIds.push(sampleId);
      args.sampleLabels[sampleId] = row.sampleId;

      // Add the sample to the matched group
      updatedSampleGroups[groupId][sampleId] = row.sampleId;

      // Populate metadata for this sample using lookup map
      for (const [columnId, value] of Object.entries(row.metadata)) {
        const column = metadataColumnsMap.get(columnId);
        if (column && (typeof value === 'string' || typeof value === 'number')) {
          column.data[sampleId] = value;
        }
      }
    }

    // Replace the entire sampleGroups object to trigger Vue reactivity
    dataset.content.sampleGroups = updatedSampleGroups;
  }

  clearImportCandidate();
  await app.allSettled();
}

// Available group labels from all MultiplexedFastq datasets
const availableGroupLabels = computed(() =>
  multiplexedFastqDatasets.value.flatMap((ds) => Object.values(ds.content.groupLabels)),
);

// Check if there are rows without samples (for highlighting import button)
const hasRowsWithoutSamples = computed(() => {
  for (const dataset of multiplexedFastqDatasets.value) {
    for (const groupId of Object.keys(dataset.content.data)) {
      const samples = dataset.content.sampleGroups?.[groupId as PlId];
      if (!samples || Object.keys(samples).length === 0) {
        return true;
      }
    }
  }
  return false;
});

// Parse all sample groups from file handles or use direct data for JSON
const parsedSampleGroups = computed(() => {
  const sampleGroups = app.model.outputs.sampleGroups;
  if (!sampleGroups) return undefined;

  const result: Record<PlId, Record<PlId, PlId[]>> = {};

  for (const [datasetId, groups] of Object.entries(sampleGroups)) {
    const dataset = app.model.data.datasets.find((ds) => ds.id === datasetId);
    if (!dataset) continue;

    // BulkCountMatrix: data is already deserialized as Record<PlId, PlId[]>
    if (dataset.content.type === 'BulkCountMatrix') {
      result[datasetId as PlId] = groups as Record<PlId, PlId[]>;
    } else if (dataset.content.type === 'MultiSampleH5AD' || dataset.content.type === 'MultiSampleSeurat') {
      // MultiSampleH5AD and MultiSampleSeurat: need to parse CSV files
      const parsedGroups = parseCsvNestedMapFromHandles<PlId, PlId, PlId>(
        reactiveFileContent,
        { [datasetId as PlId]: groups } as Parameters<typeof parseCsvNestedMapFromHandles>[1],
      );
      if (parsedGroups && parsedGroups[datasetId as PlId]) {
        result[datasetId as PlId] = parsedGroups[datasetId as PlId];
      }
    }
  }

  return result;
});

/**
 * Check if all samples are loaded for all groups from the prerun
 */
function sampleGroupsAreCalculated(dataset: GroupedDataset): boolean {
  const sg = parsedSampleGroups.value?.[dataset.id];
  if (!sg)
    return false;

  for (const [groupId, _] of Object.entries(dataset.content.data)) {
    if (!sg[groupId as PlId]) {
      return false;
    }
  }
  return true;
}

/**
 * Check if all samples are loaded for all groups from the prerun and already saved in the dataset
 */
function sampleGroupsAreSynced(dataset: GroupedDataset): boolean {
  const calculatedGroups = parsedSampleGroups.value?.[dataset.id];
  if (!calculatedGroups)
    return false;

  for (const groupId of Object.keys(dataset.content.data)) {
    const calculatedGroup: PlId[] | undefined = calculatedGroups[groupId as PlId];
    if (!calculatedGroup) {
      return false;
    }

    const datasetGroup = Object.values(dataset.content.sampleGroups?.[groupId as PlId] ?? {}) as string[];

    if (!setEquals(calculatedGroup, datasetGroup)) {
      return false;
    }
  }
  return true;
}

function syncGroupsToDataset(dataset: GroupedDataset): void {
  const datasetId = dataset.id;

  const calculatedGroups = parsedSampleGroups.value?.[datasetId];
  if (calculatedGroups) {
    // update data
    const groupToSample = {} as Record<PlId, Record<PlId, string>>;
    for (const [groupId, sampleNames] of Object.entries(calculatedGroups)) {
      if (!sampleNames)
        return;
      const mapping = {} as Record<PlId, string>;
      for (const sampleName of sampleNames) {
        const sampleId = getOrCreateSample(app, sampleName);
        mapping[sampleId] = sampleName;
      }
      groupToSample[groupId as PlId] = mapping;
    }
    if (!_.isEqual(dataset.content.sampleGroups, groupToSample)) {
      dataset.content.sampleGroups = groupToSample;
    }
  }
  app.allSettled();
}

const loadingDatasets = computed(() => autoExtractDatasets.value.filter((ds) => !sampleGroupsAreCalculated(ds)));

const datasetsToUpdate = computed(() => autoExtractDatasets.value.filter((ds) => !sampleGroupsAreSynced(ds)));

const nSamples = computed(() =>
  datasetsToUpdate.value
    .flatMap((ds) =>
      Object
        .values(parsedSampleGroups.value?.[ds.id] ?? {})
        .map((s) => s?.length ?? 0),
    ).reduce((a, b) => a + b, 0));

async function updateSamples() {
  for (const ds of datasetsToUpdate.value) {
    syncGroupsToDataset(ds);
  }
  await app.allSettled();
}
</script>

<template>
  <!-- MultiplexedFastq datasets: show import samplesheet button -->
  <PlAlert v-if="hasRowsWithoutSamples" type="success">
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <span>Import samplesheet to assign samples to file groups.</span>
      <PlBtnPrimary justifyCenter @click.stop="importSamplesheet">Import samplesheet</PlBtnPrimary>
    </div>
  </PlAlert>

  <!-- Auto-extract datasets: show progress or import button -->
  <div v-if="loadingDatasets.length > 0" class="progress-container">
    <PlProgressCell
      stage="running"
      step="Extracting samples..."
    />
  </div>
  <PlAlert v-else-if="datasetsToUpdate.length > 0" type="success">
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <span>There are {{ nSamples }} samples in file groups: click "Import Samples" to proceed.</span>
      <PlBtnPrimary justifyCenter @click.stop="updateSamples">Import samples</PlBtnPrimary>
    </div>
  </PlAlert>

  <!-- Samplesheet import dialog -->
  <ImportSamplesheetDialog
    v-if="importState.importCandidate !== undefined"
    :import-candidate="importState.importCandidate"
    :available-group-labels="availableGroupLabels"
    @on-close="clearImportCandidate"
    @on-import="handleSamplesheetImport"
  />

  <!-- Import error dialog -->
  <ImportErrorDialog
    :error-message="importState.errorMessage"
    @close="clearErrorMessage"
  />
</template>

<style>
.progress-container {
  width: 100%;
  height: 75px;
  border: 1px solid black;
  padding: 0;
  border-radius: 5px;
}
</style>
