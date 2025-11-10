<script setup lang="ts">
import type { Dataset, PlId, WithSampleGroupsData } from '@platforma-open/milaboratories.samples-and-data.model';
import { PlAlert, PlBtnPrimary, PlProgressCell, ReactiveFileContent } from '@platforma-sdk/ui-vue';
import * as _ from 'radashi';
import { computed } from 'vue';
import { useApp } from '../app';
import { parseCsvNestedMapFromHandles, setEquals } from '../util';
import { getOrCreateSample } from './datasets';

const app = useApp();
const reactiveFileContent = ReactiveFileContent.useGlobal();

const props = defineProps<{
  datasetIds: PlId[];
}>();

const datasets = computed(() => {
  return props.datasetIds.map((datasetId) => {
    const ds = app.model.args.datasets.find((ds) => ds.id === datasetId);
    if (!ds)
      throw new Error('Dataset not found');
    return ds as Dataset<WithSampleGroupsData<unknown>>;
  });
});

// Parse all sample groups from file handles or use direct data for JSON
const parsedSampleGroups = computed(() => {
  const sampleGroups = app.model.outputs.sampleGroups;
  if (!sampleGroups) return undefined;

  const result: Record<PlId, Record<PlId, PlId[]>> = {};

  for (const [datasetId, groups] of Object.entries(sampleGroups)) {
    const dataset = app.model.args.datasets.find((ds) => ds.id === datasetId);
    if (!dataset) continue;

    // BulkCountMatrix: data is already deserialized as Record<PlId, PlId[]>
    if (dataset.content.type === 'BulkCountMatrix') {
      result[datasetId as PlId] = groups as Record<PlId, PlId[]>;
    } else if (dataset.content.type === 'MultiSampleH5AD') {
      // MultiSampleH5AD: need to parse CSV files
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
function sampleGroupsAreCalculated(dataset: Dataset<WithSampleGroupsData<unknown>>): boolean {
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
function sampleGroupsAreSynced(dataset: Dataset<WithSampleGroupsData<unknown>>): boolean {
  const calculatedGroups = parsedSampleGroups.value?.[dataset.id];
  if (!calculatedGroups)
    return false;

  for (const groupId of Object.keys(dataset.content.data)) {
    const calculatedGroup: PlId[] | undefined = calculatedGroups[groupId as PlId];
    if (!calculatedGroup) {
      return false;
    }

    const datasetGroup = Object.values(dataset.content.sampleGroups?.[groupId as PlId] ?? {});

    if (!setEquals(calculatedGroup, datasetGroup)) {
      return false;
    }
  }
  return true;
}

function syncGroupsToDataset(dataset: Dataset<WithSampleGroupsData<unknown>>): void {
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

const loadingDatasets = computed(() => datasets.value.filter((ds) => !sampleGroupsAreCalculated(ds)));

const datasetsToUpdate = computed(() => datasets.value.filter((ds) => !sampleGroupsAreSynced(ds)));

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
// v-if="loadingDatasets.length > 0"
</script>

<template>
  <div v-if="loadingDatasets.length > 0" class="progress-container" >
    <PlProgressCell
      stage="running"
      step="Extracting samples..."
    />
  </div>
  <PlAlert v-else-if="datasetsToUpdate.length > 0" type="success" >
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <span>There are {{ nSamples }} samples in file groups: click "Import Samples" to proceed.</span>
      <PlBtnPrimary justifyCenter @click.stop="updateSamples">Import samples</PlBtnPrimary>
    </div>
  </PlAlert>
</template>

<style>
.progress-container{
    width: 100%;
    height: 75px;
    border: 1px solid black;
    padding: 0;
    border-radius: 5px;
}
</style>
