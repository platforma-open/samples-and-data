<script lang="ts" setup>
import { onMounted } from 'vue';
import ImportDatasetDialog from '../ImportDatasetDialog.vue';
import { useApp } from '../app';

const app = useApp();

onMounted(() => app.showImportDataset = true);
</script>

<template>
  <ImportDatasetDialog v-if="app.showImportDataset" @on-close="() => app.navigateTo('/')" />
</template>