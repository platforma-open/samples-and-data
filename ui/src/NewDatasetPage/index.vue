<script lang="ts" setup>
import { onMounted } from 'vue';
import { ImportDatasetDialog } from '../ImportDatasetDialog';
import { useApp } from '../app';

const app = useApp();

onMounted(() => app.showImportDataset = true);

const onClose = (navigated: boolean) => {
  if (!navigated) app.navigateTo('/');
};
</script>

<template>
  <ImportDatasetDialog v-if="app.showImportDataset" @on-close="onClose" />
</template>