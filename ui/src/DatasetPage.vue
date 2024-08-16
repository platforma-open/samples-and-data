<script setup lang="ts">
// import '@milaboratory/platforma-uikit/lib/dist/style.css';
// import '@milaboratory/graph-maker/dist/style.css';
import { provide, ref, watch } from 'vue';
import { useApp } from './app';
import { BtnSecondary, TextField } from '@milaboratory/platforma-uikit';
import FastqDatasetPage from './FastqDatasetPage.vue';
import { Progresses } from './injects';
import { ImportFileHandle, ImportProgress } from '@milaboratory/sdk-ui';
import { argsModel } from './lens';

const app = useApp();

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
  <btn-secondary @click="deleteTheDataset">Delete</btn-secondary>
  <text-field @update:model-value="v => dataset.update(ds => ds.label = v)" :model-value="dataset.value.label" />
  <div v-if="dataset.value.content.type === 'Fastq'">
    <FastqDatasetPage />
  </div>
</template>

<style lang="css">
.alert-error {
  background-color: red;
  color: #fff;
  padding: 12px;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 1080px;
}

fieldset {
  max-height: 300px;
  max-width: 100%;
  overflow: auto;
}
</style>
