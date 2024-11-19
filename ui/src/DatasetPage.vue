<script setup lang="ts">
import { ReadIndices } from '@platforma-open/milaboratories.samples-and-data.model';
import { PlBlockPage, PlBtnGhost, PlBtnGroup, PlBtnPrimary, PlBtnSecondary, PlCheckbox, PlDialogModal, PlMaskIcon24, PlSlideModal, PlTextField, SimpleOption } from '@platforma-sdk/ui-vue';
import { computed, reactive } from 'vue';
import { useApp } from './app';
import FastqDatasetPage from './FastqDatasetPage.vue';
import { argsModel } from './lens';
import MultilaneFastqDatasetPage from './MultilaneFastqDatasetPage.vue';
import FastaDatasetPage from './FastaDatasetPage.vue';

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

const currentReadIndices = computed(() => JSON.stringify(dataset.value.content.type === 'Fasta' ? undefined : dataset.value.content.readIndices))

function setReadIndices(newIndices: string) {
  const indicesArray = ReadIndices.parse(JSON.parse(newIndices))
  dataset.update(ds => {
    if (ds.content.type !== 'Fasta')
      ds.content.readIndices = indicesArray;
    else
      throw new Error("Can't set read indices for fasta dataset.")
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
      <PlBtnGhost @click.stop="() => data.settingsOpen = true">Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
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
    <PlBtnGroup v-if="dataset.value.content.type !== 'Fasta'" :model-value="currentReadIndices"
      @update:model-value="setReadIndices" :options="readIndicesOptions" />
    <PlBtnSecondary @click="() => data.deleteModalOpen = true" icon="delete-bin">Delete Dataset</PlBtnSecondary>
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