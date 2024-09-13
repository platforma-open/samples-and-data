<script setup lang="ts">
import { provide, reactive, ref, watch } from 'vue';
import { useApp } from './app';
import { PlBlockPage, PlBtnGhost, PlBtnSecondary, PlTextField, PlDialogModal, PlBtnPrimary, PlSlideModal, PlCheckbox } from '@milaboratory/sdk-vue';
import FastqDatasetPage from './FastqDatasetPage.vue';
import { Progresses } from './injects';
import { ImportFileHandle, ImportProgress } from '@milaboratory/sdk-ui';
import { argsModel } from './lens';

const app = useApp();

const data = reactive({
  deleteModalOpen: false,
  settingsOpen: false,
})

const datasetId = app.queryParams.id;
const dataset = argsModel(app, {
  get: args => args.datasets.find((ds) => ds.id === datasetId),
  onDisconnected: () => app.navigateTo('/')
})

const progresses = ref<Record<ImportFileHandle, ImportProgress>>({});
watch(
  () => app.outputs.fileImports,
  (fileImports) => {
    if (!fileImports?.ok) {
      progresses.value = {};
      return;
    }
    progresses.value = fileImports.value ?? {};
  },
  { immediate: true }
);
provide(Progresses, progresses);

type ReadIndices = "R1" | "R1R2";

function setReadIndices(newIndices: ReadIndices) {
  switch (newIndices) {
    case 'R1':
      break;
    case 'R1R2':
      break;
  }
}

async function deleteTheDataset() {
  await app.updateArgs((arg) => {
    arg.datasets.splice(
      arg.datasets.findIndex((ds) => ds.id === datasetId),
      1
    );
  });
}

</script>

<template>
  <PlBlockPage>
    <template #title>{{ dataset.value.label }}</template>
    <template #append>
      <PlBtnGhost :icon="'comp'" @click.stop="() => data.settingsOpen = true">Settings</PlBtnGhost>
    </template>

    <!-- :style="{ flex: 1, border: '1px solid red', height: '100%' }" -->
    <div v-if="dataset.value.content.type === 'Fastq'" :style="{ height: '100%' }">
      <FastqDatasetPage />
    </div>
  </PlBlockPage>
  <PlSlideModal v-model="data.settingsOpen" width="50%">
    <div :style="{ marginTop: '20px' }">
      <PlTextField label="Dataset Name" @update:model-value="v => dataset.update(ds => ds.label = v ?? '')"
        :model-value="dataset.value.label" />
      <PlCheckbox :model-value="dataset.value.content.gzipped"
        @update:model-value="v => dataset.update(ds => ds.content.gzipped = v)">
        Gzipped
      </PlCheckbox>
      <PlBtnPrimary icon="clear" @click="() => data.deleteModalOpen = true">Delete Dataset</PlBtnPrimary>
    </div>
  </PlSlideModal>
  <PlDialogModal v-model="data.deleteModalOpen">
    <div :style="{ marginBottom: '10px' }">Are you sure?</div>
    <div class="d-flex gap-4">
      <PlBtnPrimary @click="deleteTheDataset">Delete</PlBtnPrimary>
      <PlBtnSecondary @click="() => data.deleteModalOpen = false">Cancel</PlBtnSecondary>
    </div>
  </PlDialogModal>
</template>
