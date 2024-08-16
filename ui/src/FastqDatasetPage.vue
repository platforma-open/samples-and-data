<script setup lang="ts">
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';

import {
  ColDef,
  GridOptions,
  ISelectCellEditorParams,
  ModuleRegistry
} from '@ag-grid-community/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';

import { AgGridVue } from '@ag-grid-community/vue3';

import {
  DatasetFastq,
  FastqFileGroup,
  PlId
} from '@milaboratory/milaboratories.samples-and-data.model';
import FileCell from './FileCell.vue';
import { computed, ref, watch } from 'vue';
import { useApp } from './app';
import { argsModel } from './lens';
import { typeSafeEntries } from './util';

ModuleRegistry.registerModules([ClientSideRowModelModule]);

const app = useApp();
const datasetId = app.queryParams.id;

type FastaDatasetRow = {
  // undefined for an empty row at the end of the table
  readonly sample: PlId | undefined;
  readonly reads: FastqFileGroup;
};

const dataset = argsModel(app, {
  get: args => args.datasets.find((ds) => ds.id === datasetId) as DatasetFastq,
  onDisconnected: () => app.navigateTo('/')
})

const rowData = computed<FastaDatasetRow[]>(() => [
  ...Object.entries(dataset.value.content.data).map(([sampleId, fastqs]) => ({
    sample: sampleId as PlId,
    reads: fastqs!
  })),
  { sample: undefined, reads: {} }
]);

const readIndices = computed(() => dataset.value.content.readIndices);

const columnDefs = computed(() => {
  const res: ColDef<FastaDatasetRow>[] = [
    {
      valueGetter: (params) => params.data?.sample,
      editable: (params) => {
        // only creating new records
        return params.data?.sample === undefined;
      },
      valueSetter: (params) => {
        if (params.oldValue !== undefined) throw new Error('Unexpected edit');
        dataset.update(ds => ds.content.data[params.newValue] = {})
        return true;
      },
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: app.args.sampleIds,
        valueListGap: 10
      } satisfies ISelectCellEditorParams
    }
  ];

  for (const readIndex of readIndices.value)
    res.push({
      headerName: readIndex,
      cellRendererSelector: (params) =>
        params.data?.sample ? { component: 'FileCell' } : undefined,
      valueGetter: (params) =>
        params.data?.sample
          ? dataset.value.content.data[params.data.sample]![readIndex]
          : undefined,
      valueSetter: (params) => {
        dataset.update(ds => ds.content.data[params.data.sample!]![readIndex] = params.newValue)
        return true;
      }
    });

  return res;
});

const gridOptions: GridOptions<FastaDatasetRow> = {
  getRowId: (row) => row.data.sample ?? 'new',
  components: {
    FileCell
  }
};
</script>

<template>
  <div class="ag-theme-quartz" :style="{ height: '300px' }">
    <ag-grid-vue :style="{ height: '100%' }" :rowData="rowData" :columnDefs="columnDefs" :gridOptions="gridOptions">
    </ag-grid-vue>
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
