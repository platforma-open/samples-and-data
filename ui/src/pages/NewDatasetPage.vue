<script lang="ts" setup>
import { onMounted } from 'vue';
import { useApp } from '../app';
import ImportDatasetDialog from './modals/ImportDatasetDialog.vue';

const app = useApp();

onMounted(() => app.showImportDataset = true);
</script>

<template>
  <ImportDatasetDialog v-if="app.showImportDataset" @on-close="() => app.navigateTo('/')" />
</template>
