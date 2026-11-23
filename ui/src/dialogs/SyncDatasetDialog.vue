<script setup lang="ts">
import type {
  Dataset,
  DSContent,
  DSMultiplexedFastq,
  PlId,
  WithSampleGroupsData,
} from "@platforma-open/milaboratories.samples-and-data.model";
import { uniquePlId } from "@platforma-sdk/model";
import {
  PlAlert,
  PlBtnPrimary,
  PlFileDialog,
  PlProgressCell,
  ReactiveFileContent,
} from "@platforma-sdk/ui-vue";
import * as _ from "radashi";
import { computed } from "vue";
import { useApp } from "../app";
import ImportErrorDialog from "../components/ImportErrorDialog.vue";
import { DEFAULT_TABLE_FILE_EXTENSIONS } from "../composables/useTableImport";
import { useUploadedTableImport } from "../composables/useUploadedTableImport";
import { parseCsvNestedMapFromHandles, setEquals } from "../util";
import { assignMultiSampleXsvSamples, getOrCreateSample, multiSampleXsvLabels } from "./datasets";
import type { SamplesheetImportData } from "./ImportSamplesheetDialog.vue";
import ImportSamplesheetDialog from "./ImportSamplesheetDialog.vue";

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
    if (!ds) throw new Error("Dataset not found");
    return ds as GroupedDataset;
  });
});

// Check if any dataset is MultiplexedFastq (requires samplesheet import)
const multiplexedFastqDatasets = computed(
  () =>
    datasets.value.filter((ds) => ds.content.type === "MultiplexedFastq") as DSMultiplexedFastq[],
);

// Datasets that support auto-extraction (BulkCountMatrix, MultiSampleH5AD, MultiSampleSeurat, MultiSampleXsv)
const autoExtractDatasets = computed(() =>
  datasets.value.filter((ds) =>
    ["BulkCountMatrix", "MultiSampleH5AD", "MultiSampleSeurat", "MultiSampleXsv"].includes(
      ds.content.type,
    ),
  ),
);

// Samplesheet import logic
const {
  importState,
  fileDialogOpened,
  openFileDialog,
  handleFileSelected,
  onImportClose,
  clearErrorMessage,
} = useUploadedTableImport({
  getHandle: () => app.model.data.samplesheetUploadHandle,
  setHandle: (handle) => {
    app.model.data.samplesheetUploadHandle = handle;
  },
  getFile: () => app.model.outputs.samplesheetFile,
});

async function handleSamplesheetImport(importData: SamplesheetImportData) {
  const args = app.model.data;

  // Create metadata columns lookup map for O(1) access
  const metadataColumnsMap = new Map(importData.metadataColumns.map((col) => [col.id, col]));

  for (const dataset of multiplexedFastqDatasets.value) {
    // Create group label to groupId lookup map for O(1) access
    const groupLabelToId = new Map(
      Object.entries(dataset.content.groupLabels).map(([groupId, label]) => [
        label,
        groupId as PlId,
      ]),
    );

    // Merge any newly-declared tags from the dialog into the dataset's tag
    // set. New tags get an empty value backfilled into every existing rule
    // so the (rules, tags) invariant holds.
    const existingTags = dataset.content.barcodeTags;
    const newTags = importData.declaredTags.filter((t) => !existingTags.includes(t));
    let updatedTags = existingTags;
    let updatedRules = [...dataset.content.barcodeRules];
    if (newTags.length > 0) {
      updatedTags = [...existingTags, ...newTags];
      updatedRules = updatedRules.map((rule) => {
        const patch: Record<string, string> = {};
        for (const t of newTags) patch[t] = "";
        return { ...rule, barcodes: { ...rule.barcodes, ...patch } };
      });
    }

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

      // Resolve the block-level sampleId by label: reuse the existing sampleId
      // when a sample with the same label is already in the block, otherwise
      // mint a new one. This makes a re-import (or a second file group sharing
      // the same sample names) collapse onto one sampleId instead of forking
      // a duplicate, so the multiplexed FASTQ linker can legitimately carry
      // `(groupA, sId), (groupB, sId)` for a sample that appears in both groups.
      const sampleId = getOrCreateSample(app, row.sampleId);

      // Add the sample to the matched group
      updatedSampleGroups[groupId][sampleId] = row.sampleId;

      // Populate metadata for this sample using lookup map
      for (const [columnId, value] of Object.entries(row.metadata)) {
        const column = metadataColumnsMap.get(columnId);
        if (column && (typeof value === "string" || typeof value === "number")) {
          column.data[sampleId] = value;
        }
      }

      // Append a new BarcodeRule when the row carries any barcode value.
      // (When the dataset has no declared tags, `row.barcodes` is `{}` and we
      // skip rule creation — the operator must declare tags first.)
      const tagEntries = Object.entries(row.barcodes ?? {});
      if (tagEntries.length > 0 && tagEntries.every(([, v]) => v !== "")) {
        updatedRules.push({
          ruleId: uniquePlId(),
          sampleGroupId: groupId,
          sampleId,
          barcodes: { ...row.barcodes },
        });
      }
    }

    // Replace the entire sampleGroups object to trigger Vue reactivity
    dataset.content.sampleGroups = updatedSampleGroups;
    dataset.content.barcodeTags = updatedTags;
    dataset.content.barcodeRules = updatedRules;
  }

  onImportClose();
  await app.allSettled();
}

// Available group labels from all MultiplexedFastq datasets
const availableGroupLabels = computed(() =>
  multiplexedFastqDatasets.value.flatMap((ds) => Object.values(ds.content.groupLabels)),
);

// Declared barcode tags. The dialog handles a single dataset page at a time
// (props.datasetIds always carries one id when SyncDatasetDialog is mounted
// from MultiplexedFastqDatasetPage), so we read the first dataset's tags.
const barcodeTags = computed<string[]>(
  () => multiplexedFastqDatasets.value[0]?.content.barcodeTags ?? [],
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

    // BulkCountMatrix and MultiSampleXsv: data is already deserialized as Record<PlId, PlId[]>
    if (dataset.content.type === "BulkCountMatrix" || dataset.content.type === "MultiSampleXsv") {
      result[datasetId as PlId] = groups as Record<PlId, PlId[]>;
    } else if (
      dataset.content.type === "MultiSampleH5AD" ||
      dataset.content.type === "MultiSampleSeurat"
    ) {
      // MultiSampleH5AD and MultiSampleSeurat: need to parse CSV files
      const parsedGroups = parseCsvNestedMapFromHandles<PlId, PlId, PlId>(reactiveFileContent, {
        [datasetId as PlId]: groups,
      } as Parameters<typeof parseCsvNestedMapFromHandles>[1]);
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
  if (!sg) return false;

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
  if (!calculatedGroups) return false;

  for (const groupId of Object.keys(dataset.content.data)) {
    const calculatedGroup: PlId[] | undefined = calculatedGroups[groupId as PlId];
    if (!calculatedGroup) {
      return false;
    }

    const datasetGroup = Object.values(
      dataset.content.sampleGroups?.[groupId as PlId] ?? {},
    ) as string[];

    if (!setEquals(calculatedGroup, datasetGroup)) {
      return false;
    }
  }
  return true;
}

/** Values found in each file of a dataset, or undefined while a file is still being read */
function valuesPerGroup(dataset: GroupedDataset): Record<PlId, string[]> | undefined {
  const calculatedGroups = parsedSampleGroups.value?.[dataset.id];
  if (!calculatedGroups) return undefined;
  const result: Record<PlId, string[]> = {};
  for (const groupId of Object.keys(dataset.content.data) as PlId[]) {
    const values = calculatedGroups[groupId];
    if (!values) return undefined;
    result[groupId] = values;
  }
  return result;
}

function syncGroupsToDataset(dataset: GroupedDataset): void {
  const datasetId = dataset.id;

  const calculatedGroups = parsedSampleGroups.value?.[datasetId];
  if (calculatedGroups) {
    // update data
    let groupToSample = {} as Record<PlId, Record<PlId, string>>;
    if (dataset.content.type === "MultiSampleXsv") {
      // A value found in several files becomes one sample per file
      const values = valuesPerGroup(dataset);
      if (!values) return;
      groupToSample = assignMultiSampleXsvSamples(
        values,
        dataset.content.groupLabels,
        dataset.content.sampleGroups,
        (label) => getOrCreateSample(app, label),
      );
    } else {
      for (const [groupId, sampleNames] of Object.entries(calculatedGroups)) {
        if (!sampleNames) return;
        const mapping = {} as Record<PlId, string>;
        for (const sampleName of sampleNames) {
          const sampleId = getOrCreateSample(app, sampleName);
          mapping[sampleId] = sampleName;
        }
        groupToSample[groupId as PlId] = mapping;
      }
    }
    if (!_.isEqual(dataset.content.sampleGroups, groupToSample)) {
      dataset.content.sampleGroups = groupToSample;
    }
  }
  app.allSettled();
}

/** Error of the prerun that extracts samples, e.g. a sample column missing from a file */
const sampleGroupsError = computed(() => app.model.outputErrors.sampleGroups?.message);

const loadingDatasets = computed(() =>
  autoExtractDatasets.value.filter((ds) => !sampleGroupsAreCalculated(ds)),
);

const datasetsToUpdate = computed(() =>
  autoExtractDatasets.value.filter((ds) => !sampleGroupsAreSynced(ds)),
);

/** Labels of the samples "Import samples" gives a dataset */
function sampleLabels(ds: GroupedDataset): string[] {
  if (ds.content.type === "MultiSampleXsv") {
    const values = valuesPerGroup(ds);
    if (!values) return [];
    return Object.values(multiSampleXsvLabels(values, ds.content.groupLabels)).flatMap((labels) =>
      Object.values(labels),
    );
  }
  return Object.values(parsedSampleGroups.value?.[ds.id] ?? {}).flatMap((s) => s ?? []);
}

// Distinct labels: a name found in several file groups is one sample, except within a
// Multisample CSV/TSV dataset, where it is one sample per file
const nSamples = computed(
  () => new Set(datasetsToUpdate.value.flatMap((ds) => sampleLabels(ds))).size,
);

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
    <div style="display: flex; align-items: center; justify-content: space-between">
      <span>Import samplesheet to assign samples to file groups.</span>
      <PlBtnPrimary justifyCenter @click.stop="openFileDialog">Import samplesheet</PlBtnPrimary>
    </div>
  </PlAlert>

  <!-- Auto-extract datasets: show the extraction error, progress or import button -->
  <PlAlert v-if="sampleGroupsError && autoExtractDatasets.length > 0" type="error">
    Could not extract samples: {{ sampleGroupsError }}
  </PlAlert>
  <div v-else-if="loadingDatasets.length > 0" class="progress-container">
    <PlProgressCell stage="running" step="Extracting samples..." />
  </div>
  <PlAlert v-else-if="datasetsToUpdate.length > 0" type="success">
    <div style="display: flex; align-items: center; justify-content: space-between">
      <span
        >There are {{ nSamples }} samples in file groups: click "Import Samples" to proceed.</span
      >
      <PlBtnPrimary justifyCenter @click.stop="updateSamples">Import samples</PlBtnPrimary>
    </div>
  </PlAlert>

  <!-- Samplesheet import dialog -->
  <ImportSamplesheetDialog
    v-if="importState.importCandidate !== undefined"
    :import-candidate="importState.importCandidate"
    :available-group-labels="availableGroupLabels"
    :barcode-tags="barcodeTags"
    @on-close="onImportClose"
    @on-import="handleSamplesheetImport"
  />

  <PlFileDialog
    v-model="fileDialogOpened"
    :close-on-outside-click="false"
    :multi="false"
    :extensions="[...DEFAULT_TABLE_FILE_EXTENSIONS]"
    title="Select samplesheet"
    @import:files="(e) => handleFileSelected(e.files)"
  />

  <!-- Import error dialog -->
  <ImportErrorDialog :error-message="importState.errorMessage" @close="clearErrorMessage" />
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
