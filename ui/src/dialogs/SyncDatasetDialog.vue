<script setup lang="ts">
import type { Dataset, PlId, WithSampleGroupsData } from '@platforma-open/milaboratories.samples-and-data.model';
import { PlAlert, PlBtnPrimary, PlProgressCell } from '@platforma-sdk/ui-vue';
import * as _ from 'radashi';
import { computed } from 'vue';
import { useApp } from '../app';
import { getOrCreateSample } from './datasets';

const app = useApp();

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

/**
 * Check if all samples are loaded for all groups from the prerun
 */
function sampleGroupsAreCalculated(dataset: Dataset<WithSampleGroupsData<unknown>>): boolean {
  const sg = app.model.outputs.sampleGroups?.[dataset.id];
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
  const sg = app.model.outputs.sampleGroups?.[dataset.id];
  if (!sg)
    return false;

  for (const groupId of Object.keys(dataset.content.data)) {
    const g = sg[groupId as PlId];
    if (!g) {
      return false;
    }
    if (g.length != dataset.content.sampleGroups?.[groupId as PlId]?.length) {
      return false;
    }
  }
  return true;
}

function syncGroupsToDataset(dataset: Dataset<WithSampleGroupsData<unknown>>): void {
  const datasetId = dataset.id;

  const sg = app.model.outputs.sampleGroups?.[datasetId];
  if (sg) {
    // update data
    const groupToSample = {} as Record<PlId, PlId[]>;
    for (const [groupId, samples] of Object.entries(sg)) {
      if (!samples) return;
      const sampleIds = [];
      for (const sampleLabel of samples) {
        const sampleId = getOrCreateSample(app, sampleLabel);
        sampleIds.push(sampleId);
      }
      groupToSample[groupId as PlId] = sampleIds.sort();
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
        .values(app.model.outputs.sampleGroups?.[ds.id] ?? {})
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
