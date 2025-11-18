<script setup lang="ts">
import {
  PlBlockPage,
  PlBtnGhost,
  PlBtnPrimary,
  PlBtnSecondary,
  PlDialogModal,
  PlEditableTitle,
} from '@platforma-sdk/ui-vue';
import { ref } from 'vue';
import { useApp } from '../app';
// import UpdateDatasetDialog from '../dialogs/__UpdateDatasetDialog.__xue';
import { datasetTypeLabels } from '../dialogs/datasets';
import ImportDatasetDialog from '../dialogs/ImportDatasetDialog.vue';
import FastaDatasetPage from '../pages/FastaDatasetPage.vue';
import FastqDatasetPage from '../pages/FastqDatasetPage.vue';
import MultilaneFastqDatasetPage from '../pages/MultilaneFastqDatasetPage.vue';
import MultiplexedFastqDatasetPage from '../pages/MultiplexedFastqDatasetPage.vue';
import TaggedFastqDatasetPage from '../pages/TaggedFastqDatasetPage.vue';
import TaggedXsvDatasetPage from '../pages/TaggedXsvDatasetPage.vue';
import XsvDatasetPage from '../pages/XsvDatasetPage.vue';
import BulkCountMatrixDatasetPage from './BulkCountMatrixDatasetPage.vue';
import H5adDatasetPage from './H5adDatasetPage.vue';
import SeuratDatasetPage from './SeuratDatasetPage.vue';
import MultiSampleH5adDatasetPage from './MultiSampleH5adDatasetPage.vue';
import MultiSampleSeuratDatasetPage from './MultiSampleSeuratDatasetPage.vue';
import CellRangerMtxDatasetPage from './CellRangerMtxDatasetPage.vue';

const app = useApp();

const deleteModalOpen = ref(false);

const datasetId = app.queryParams.id;

const dataset = (() => {
  const ds = app.model.args.datasets.find((ds) => ds.id === datasetId);
  if (!ds)
    throw new Error('Dataset not found');
  return ds;
})();

async function deleteTheDataset() {
  const index = app.model.args.datasets.findIndex((ds) => ds.id === datasetId);
  if (index === -1)
    throw new Error('Dataset not found');

  // Collect file handles from the dataset to remove them from h5adFilesToPreprocess or seuratFilesToPreprocess
  const datasetContent = dataset.content;
  // Extract all file handles from the dataset
  const filesToRemove = Object.values(datasetContent.data).filter((fh) => fh !== null);

  if (datasetContent.type === 'H5AD' || datasetContent.type === 'MultiSampleH5AD') {
    // Remove these files from h5adFilesToPreprocess
    if (filesToRemove.length > 0) {
      app.model.args.h5adFilesToPreprocess = app.model.args.h5adFilesToPreprocess.filter(
        (fileHandle) => !filesToRemove.includes(fileHandle),
      );
    }
  }

  if (datasetContent.type === 'Seurat' || datasetContent.type === 'MultiSampleSeurat') {
    // Remove these files from seuratFilesToPreprocess
    if (filesToRemove.length > 0) {
      app.model.args.seuratFilesToPreprocess = app.model.args.seuratFilesToPreprocess.filter(
        (fileHandle) => !filesToRemove.includes(fileHandle),
      );
    }
  }

  app.model.args.datasets.splice(index, 1);
  await app.allSettled();
  await app.navigateTo('/');
}

const datasetTypeLabel = datasetTypeLabels[dataset.content.type];

</script>

<template>
  <PlBlockPage>
    <template #title>
      <PlEditableTitle v-model="dataset.label" max-width="600px" placeholder="Dataset" :max-length="40" />
    </template>
    <template #append>
      <PlBtnSecondary :disabled="true" justifyCenter size="small"> {{ datasetTypeLabel }} </PlBtnSecondary>
      <PlBtnGhost icon="delete-bin" @click="() => (deleteModalOpen = true)">Delete Dataset</PlBtnGhost>
      <PlBtnGhost
        v-if="dataset.content.type !== 'TaggedFastq'"
        icon="dna-import" @click.stop="() => (app.showImportDataset = true)"
      >
        Add Files
      </PlBtnGhost>
    </template>
    <template v-if="dataset.content.type === 'Fastq'">
      <FastqDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'MultilaneFastq'">
      <MultilaneFastqDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'MultiplexedFastq'">
      <MultiplexedFastqDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'Fasta'">
      <FastaDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'TaggedFastq'">
      <TaggedFastqDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'Xsv'">
      <XsvDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'TaggedXsv'">
      <TaggedXsvDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'CellRangerMTX'">
      <CellRangerMtxDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'H5AD'">
      <H5adDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'Seurat'">
      <SeuratDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'MultiSampleH5AD'">
      <MultiSampleH5adDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'MultiSampleSeurat'">
      <MultiSampleSeuratDatasetPage />
    </template>
    <template v-else-if="dataset.content.type === 'BulkCountMatrix'">
      <BulkCountMatrixDatasetPage />
    </template>
  </PlBlockPage>

  <!-- Delete dataset confirmation dialog -->
  <PlDialogModal v-model="deleteModalOpen">
    <template #title>Are you sure?</template>
    <template #actions>
      <PlBtnPrimary @click="deleteTheDataset">Delete</PlBtnPrimary>
      <PlBtnSecondary @click="() => (deleteModalOpen = false)">Cancel</PlBtnSecondary>
    </template>
  </PlDialogModal>

  <ImportDatasetDialog v-if="app.showImportDataset" :target-dataset="dataset.id" />
</template>
