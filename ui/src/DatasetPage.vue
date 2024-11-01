<script setup lang="ts">
import { ReadIndices } from '@platforma-open/milaboratories.samples-and-data.model';
import { PlBlockPage, PlBtnGhost, PlBtnGroup, PlBtnPrimary, PlBtnSecondary, PlCheckbox, PlDialogModal, PlSlideModal, PlTextField, SimpleOption } from '@platforma-sdk/ui-vue';
import { computed, reactive } from 'vue';
import { useApp } from './app';
import FastqDatasetPage from './FastqDatasetPage.vue';
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
});

const readIndicesOptions: SimpleOption<string>[] = [{
  value: JSON.stringify(["R1"]),
  text: "R1"
}, {
  value: JSON.stringify(["R1", "R2"]),
  text: "R1, R2"
}]

const currentReadIndices = computed(() => JSON.stringify(dataset.value.content.readIndices))

function setReadIndices(newIndices: string) {
  const indicesArray = ReadIndices.parse(JSON.parse(newIndices))
  // const readIndicesToClean = AllReadIndices.filter(r => !indicesArray.includes(r));
  dataset.update(ds => {
    ds.content.readIndices = indicesArray;
    // for (const [_, fg] of Object.entries(ds.content.data))
    //   for (const r of readIndicesToClean)
    //     delete fg[r];
  })
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
      <PlBtnGhost :icon="'settings-2'" @click.stop="() => data.settingsOpen = true">Settings</PlBtnGhost>
    </template>
    <div v-if="dataset.value.content.type === 'Fastq'" :style="{ height: '100%' }">
      <FastqDatasetPage />
    </div>
  </PlBlockPage>

  <!-- Settings panel -->
  <PlSlideModal v-model="data.settingsOpen">
    <template #title>Settings</template>

    <PlTextField label="Dataset label" @update:model-value="v => dataset.update(ds => ds.label = v ?? '')"
      :model-value="dataset.value.label" />
    <PlCheckbox :model-value="dataset.value.content.gzipped"
      @update:model-value="v => dataset.update(ds => ds.content.gzipped = v)">
      Gzipped
    </PlCheckbox>
    <PlBtnGroup :model-value="currentReadIndices" @update:model-value="setReadIndices" :options="readIndicesOptions" />
    <PlBtnSecondary icon="delete" @click="() => data.deleteModalOpen = true">Delete Dataset</PlBtnSecondary>
  </PlSlideModal>

  <!-- Delete dataset confirmation dialog -->
  <PlDialogModal v-model="data.deleteModalOpen">
    <div :style="{ marginBottom: '10px' }">Are you sure?</div>
    <div class="d-flex gap-4">
      <PlBtnPrimary @click="deleteTheDataset">Delete</PlBtnPrimary>
      <PlBtnSecondary @click="() => data.deleteModalOpen = false">Cancel</PlBtnSecondary>
    </div>
  </PlDialogModal>
</template>