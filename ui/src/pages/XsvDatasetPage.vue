<script setup lang="ts">
import type {
  ColDef,
  GridOptions,
} from 'ag-grid-enterprise';
import {
  ClientSideRowModelModule,
  MenuModule,
  ModuleRegistry,
  RichSelectModule,
} from 'ag-grid-enterprise';

import { AgGridVue } from 'ag-grid-vue3';

import type { DSXsv, PlId } from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle } from '@platforma-sdk/model';
import type { PlAgHeaderComponentParams } from '@platforma-sdk/ui-vue';
import { AgGridTheme, makeRowNumberColDef, PlAgCellFile, PlAgColumnHeader } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';
import { agSampleIdColumnDef, getSelectedSamples } from '../util';

ModuleRegistry.registerModules([ClientSideRowModelModule, RichSelectModule, MenuModule]);

const app = useApp();

const datasetId = app.queryParams.id;

const dataset = (() => {
  const ds = app.model.data.datasets.find((ds) => ds.id === datasetId);
  if (!ds)
    throw new Error('Dataset not found');
  return ds as DSXsv;
})();

type XsvDatasetRow = {
  // undefined for an empty row at the end of the table
  readonly sample: PlId;
  readonly data?: ImportFileHandle | null;
};

const rowData = computed(() => Object.entries(dataset.content.data).map(
  ([sampleId, data]) => ({
    sample: sampleId as PlId,
    data,
  }),
));

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const columnDefs = computed(() => {
  const res: ColDef<XsvDatasetRow>[] = [
    makeRowNumberColDef(),
    agSampleIdColumnDef(app),
  ];

  res.push({
    headerName: 'Data',
    flex: 2,
    cellStyle: { padding: 0 },
    headerComponent: PlAgColumnHeader,
    headerComponentParams: { type: 'File' } satisfies PlAgHeaderComponentParams,

    cellRendererParams: {
      resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
        const progresses = app.progresses;
        if (!fileHandle) return undefined;
        else return progresses[fileHandle];
      },
    },

    cellRendererSelector: (params) =>
      params.data?.sample
        ? {
            component: 'PlAgCellFile',
            params: {
              extensions: dataset.content.gzipped ? (dataset.content.xsvType ? [dataset.content.xsvType + '.gz'] : ['csv.gz', 'tsv.gz']) : (dataset.content.xsvType ? [dataset.content.xsvType] : ['csv', 'tsv']),
            },
          }
        : undefined,
    valueGetter: (params) =>
      params.data?.sample
        ? dataset.content.data[params.data.sample]
        : undefined,
    valueSetter: (params) => {
      const sample = params.data.sample;
      dataset.content.data[sample] = params.newValue ?? null;
      return true;
    },
  } as ColDef<XsvDatasetRow, ImportFileHandle>);

  return res;
});

const gridOptions: GridOptions<XsvDatasetRow> = {
  getRowId: (row) => row.data.sample,
  rowSelection: {
    mode: 'multiRow',
    checkboxes: false,
    headerCheckbox: false,
  },
  rowHeight: 45,
  getMainMenuItems: () => {
    return [];
  },
  getContextMenuItems: (params) => {
    if (getSelectedSamples(params.api, params.node).length === 0) return [];
    return [
      {
        name: 'Delete',
        action: (params) => {
          const samplesToDelete = getSelectedSamples(params.api, params.node);
          for (const s of samplesToDelete)
            delete dataset.content.data[s];
        },
      },
    ];
  },
  components: {
    PlAgCellFile,
  },
};
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
