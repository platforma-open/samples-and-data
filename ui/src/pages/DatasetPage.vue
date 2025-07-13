<script setup lang="ts">
import type { DatasetType } from '@platforma-open/milaboratories.samples-and-data.model';
import type {
  ListOption,
  SimpleOption,
} from '@platforma-sdk/ui-vue';
import {
  PlBlockPage,
  PlBtnGhost,
  PlBtnGroup,
  PlBtnPrimary,
  PlBtnSecondary,
  PlCheckbox,
  PlDialogModal,
  PlDropdown,
  PlEditableTitle,
  PlSlideModal,
} from '@platforma-sdk/ui-vue';
import { computed, reactive } from 'vue';
import { useApp } from '../app';
import { argsModel } from '../lens';
import FastaDatasetPage from './datasets/FastaDatasetPage.vue';
import FastqDatasetPage from './datasets/FastqDatasetPage.vue';
import MultilaneFastqDatasetPage from './datasets/MultilaneFastqDatasetPage.vue';
import TaggedFastqDatasetPage from './datasets/TaggedFastqDatasetPage.vue';
import UpdateDatasetDialog from './modals/UpdateDatasetDialog.vue';

const app = useApp();

const data = reactive({
  deleteModalOpen: false,
  settingsOpen: false,
});

const datasetId = app.queryParams.id;
const dataset = argsModel(app, {
  get: (args) => args.datasets.find((ds) => ds.id === datasetId),
  onDisconnected: () => app.navigateTo('/'),
});

const readIndicesOptions: SimpleOption<string>[] = [
  {
    value: JSON.stringify(['R1']),
    text: 'R1',
  },
  {
    value: JSON.stringify(['R1', 'R2']),
    text: 'R1, R2',
  },
];

const currentReadIndices = computed(() =>
  JSON.stringify(
    dataset.value.content.type === 'Fasta' ? undefined : dataset.value.content.readIndices,
  ),
);

function setReadIndices(newIndices: string) {
  const indicesArray = JSON.parse(newIndices);
  dataset.update((ds) => {
    if (ds.content.type !== 'Fasta') ds.content.readIndices = indicesArray;
    else throw new Error('Can\'t set read indices for fasta dataset.');
  });
}

async function deleteTheDataset() {
  await app.updateArgs((arg) => {
    arg.datasets.splice(
      arg.datasets.findIndex((ds) => ds.id === datasetId),
      1,
    );
  });
}

const datasetTypeOptions: ListOption<DatasetType>[] = [
  { value: 'Fasta', label: 'FASTA' },
  { value: 'Fastq', label: 'FASTQ' },
  { value: 'MultilaneFastq', label: 'Multi-lane FASTQ' },
  { value: 'TaggedFastq', label: 'Tagged FASTQ' },
];
</script>

<template>
  <PlBlockPage>
    <template #title>
      <PlEditableTitle v-model="dataset.value.label" max-width="600px" placeholder="Dataset (1)" :max-length="40" />
    </template>
    <template #append>
      <PlBtnGhost icon="delete-bin" @click="() => (data.deleteModalOpen = true)">Delete Dataset</PlBtnGhost>
      <PlBtnGhost
        v-if="dataset.value.content.type !== 'TaggedFastq'"
        icon="dna-import" @click.stop="() => (app.showImportDataset = true)"
      >
        Add sequencing data
      </PlBtnGhost>
      <PlBtnGhost icon="settings" @click.stop="() => (data.settingsOpen = true)">Settings</PlBtnGhost>
    </template>
    <template v-if="dataset.value.content.type === 'Fastq'">
      <FastqDatasetPage />
    </template>
    <template v-else-if="dataset.value.content.type === 'MultilaneFastq'">
      <MultilaneFastqDatasetPage />
    </template>
    <template v-else-if="dataset.value.content.type === 'Fasta'">
      <FastaDatasetPage />
    </template>
    <template v-else-if="dataset.value.content.type === 'TaggedFastq'">
      <TaggedFastqDatasetPage />
    </template>
  </PlBlockPage>

  <!-- Settings panel -->
  <PlSlideModal v-model="data.settingsOpen">
    <template #title>Settings</template>
    <PlDropdown
      label="Dataset Type" :options="datasetTypeOptions" :model-value="dataset.value.content.type"
      :disabled="true"
    />
    <PlCheckbox
      :model-value="dataset.value.content.gzipped"
      @update:model-value="(v) => dataset.update((ds) => (ds.content.gzipped = v))"
    >
      Gzipped
    </PlCheckbox>
    <PlBtnGroup
      v-if="dataset.value.content.type !== 'Fasta'" :model-value="currentReadIndices"
      :options="readIndicesOptions" @update:model-value="setReadIndices"
    />
  </PlSlideModal>

  <!-- Delete dataset confirmation dialog -->
  <PlDialogModal v-model="data.deleteModalOpen">
    <template #title>Are you sure?</template>
    <template #actions>
      <PlBtnPrimary @click="deleteTheDataset">Delete</PlBtnPrimary>
      <PlBtnSecondary @click="() => (data.deleteModalOpen = false)">Cancel</PlBtnSecondary>
    </template>
  </PlDialogModal>

  <UpdateDatasetDialog v-if="app.showImportDataset" :target-dataset="dataset.value.id" />
</template>
