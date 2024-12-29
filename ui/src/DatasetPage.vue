<script setup lang="ts">
import { DatasetType, ReadIndices } from '@platforma-open/milaboratories.samples-and-data.model';
import {
  ListOption,
  PlBlockPage,
  PlBtnGhost,
  PlBtnGroup,
  PlBtnPrimary,
  PlBtnSecondary,
  PlCheckbox,
  PlDialogModal,
  PlDropdown,
  PlEditableTitle,
  PlMaskIcon24,
  PlSlideModal,
  PlTextField,
  SimpleOption
} from '@platforma-sdk/ui-vue';
import { computed, reactive } from 'vue';
import { useApp } from './app';
import FastqDatasetPage from './FastqDatasetPage.vue';
import { argsModel } from './lens';
import MultilaneFastqDatasetPage from './MultilaneFastqDatasetPage.vue';
import FastaDatasetPage from './FastaDatasetPage.vue';
import ImportDatasetDialog from './ImportDatasetDialog.vue';
import TaggedFastqDatasetPage from './TaggedFastqDatasetPage.vue';

const app = useApp();

const data = reactive({
  deleteModalOpen: false,
  settingsOpen: false,
  showImportDataset: false
});

const datasetId = app.queryParams.id;
const dataset = argsModel(app, {
  get: (args) => args.datasets.find((ds) => ds.id === datasetId),
  onDisconnected: () => app.navigateTo('/')
});

const readIndicesOptions: SimpleOption<string>[] = [
  {
    value: JSON.stringify(['R1']),
    text: 'R1'
  },
  {
    value: JSON.stringify(['R1', 'R2']),
    text: 'R1, R2'
  }
];

const currentReadIndices = computed(() =>
  JSON.stringify(
    dataset.value.content.type === 'Fasta' ? undefined : dataset.value.content.readIndices
  )
);

function setReadIndices(newIndices: string) {
  const indicesArray = ReadIndices.parse(JSON.parse(newIndices));
  dataset.update((ds) => {
    if (ds.content.type !== 'Fasta') ds.content.readIndices = indicesArray;
    else throw new Error("Can't set read indices for fasta dataset.");
  });
}

async function deleteTheDataset() {
  await app.updateArgs((arg) => {
    arg.datasets.splice(
      arg.datasets.findIndex((ds) => ds.id === datasetId),
      1
    );
  });
}

const datasetTypeOptions: ListOption<DatasetType>[] = [
  { value: 'Fasta', label: "FASTA" },
  { value: 'Fastq', label: "FASTQ" },
  { value: 'MultilaneFastq', label: "Multi-lane FASTQ" },
  { value: 'TaggedFastq', label: "Tagged FASTQ" },
]
</script>

<template>
  <PlBlockPage>
    <template #title>
      <PlEditableTitle max-width="600px" placeholder="Dataset (1)" :max-length="40" v-model="dataset.value.label" />
    </template>
    <template #append>
      <PlBtnGhost @click="() => (data.deleteModalOpen = true)" icon="delete-bin">Delete Dataset</PlBtnGhost>
      <PlBtnGhost v-if="dataset.value.content.type !== 'TaggedFastq'"
        @click.stop="() => (data.showImportDataset = true)" icon="dna-import">
        Add sequencing data
      </PlBtnGhost>
      <PlBtnGhost @click.stop="() => (data.settingsOpen = true)" icon="settings">Settings</PlBtnGhost>
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
    <PlDropdown label="Dataset Type" :options="datasetTypeOptions" :model-value="dataset.value.content.type"
      :disabled="true" />
    <PlCheckbox :model-value="dataset.value.content.gzipped"
      @update:model-value="(v) => dataset.update((ds) => (ds.content.gzipped = v))">
      Gzipped
    </PlCheckbox>
    <PlBtnGroup v-if="dataset.value.content.type !== 'Fasta'" :model-value="currentReadIndices"
      @update:model-value="setReadIndices" :options="readIndicesOptions" />
  </PlSlideModal>

  <!-- Delete dataset confirmation dialog -->
  <PlDialogModal v-model="data.deleteModalOpen">
    <template #title>Are you sure?</template>
    <template #actions>
      <PlBtnPrimary @click="deleteTheDataset">Delete</PlBtnPrimary>
      <PlBtnSecondary @click="() => (data.deleteModalOpen = false)">Cancel</PlBtnSecondary>
    </template>
  </PlDialogModal>

  <ImportDatasetDialog v-if="data.showImportDataset" :target-dataset="dataset.value.id"
    @on-close="data.showImportDataset = false" />
</template>
