<script lang="ts" setup>
import { onMounted } from 'vue';
import { useApp } from '../app';
import ImportDatasetDialog from '../dialogs/ImportDatasetDialog.vue';

const app = useApp();

onMounted(() => app.showImportDataset = true);

const onClose = (navigated: boolean) => {
  if (!navigated) app.navigateTo('/');
};
</script>

<template>
  <ImportDatasetDialog v-if="app.showImportDataset" @on-close="onClose" />
</template>
