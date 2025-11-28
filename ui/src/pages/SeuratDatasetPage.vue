<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3';

import type { DSSeurat } from '@platforma-open/milaboratories.samples-and-data.model';
import { AgGridTheme } from '@platforma-sdk/ui-vue';
import { useFileDatasetPage } from '../composables/useFileDatasetPage';

const { rowData, defaultColDef, columnDefs, gridOptions } = useFileDatasetPage<DSSeurat>({
  headerName: 'Seurat RDS file',
  extensions: ['rds', 'RDS'],
});
</script>

<template>
  <AgGridVue
    :theme="AgGridTheme"
    :style="{ height: '100%' }"
    :rowData="rowData"
    :defaultColDef="defaultColDef"
    :columnDefs="columnDefs"
    :gridOptions="gridOptions"
  />
</template>
