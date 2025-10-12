<script setup lang="ts">
import {
  type ColDef,
  type GridOptions,
  ClientSideRowModelModule,
  MenuModule,
  ModuleRegistry,
  RichSelectModule,
} from 'ag-grid-enterprise';
import { AgGridVue } from 'ag-grid-vue3';

import type {
  DSFastq,
  FastqFileGroup,
  PlId,
} from '@platforma-open/milaboratories.samples-and-data.model';
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
  const ds = app.model.args.datasets.find((ds) => ds.id === datasetId);
  if (!ds)
    throw new Error('Dataset not found');
  return ds as DSFastq;
})();

type FastqDatasetRow = {
  readonly sample: PlId ;
  readonly reads: FastqFileGroup;
};

const rowData = computed(() => Object.entries(dataset.content.data).map(
  ([sampleId, fastqs]) => ({
    sample: sampleId as PlId,
    reads: fastqs!,
  })));

const readIndices = computed(() => dataset.content.readIndices);

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const columnDefs = computed(() => {
  const progresses = app.progresses;

  const res: ColDef<FastqDatasetRow>[] = [
    makeRowNumberColDef(),
    agSampleIdColumnDef(app),
  ];

  for (const readIndex of readIndices.value)
    res.push({
      headerName: readIndex,
      flex: 2,
      cellStyle: { padding: 0 },
      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'File' } satisfies PlAgHeaderComponentParams,

      cellRendererParams: {
        resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
          if (!fileHandle)
            return undefined;
          else
            return progresses[fileHandle];
        },
      },

      cellRendererSelector: (params) =>
        params.data?.sample
          ? {
              component: 'PlAgCellFile',
              params: {
                extensions: dataset.content.gzipped ? ['fastq.gz', 'fq.gz'] : ['fastq', 'fq'],
              },
            }
          : undefined,

      valueGetter: (params) =>
        params.data?.sample
          ? dataset.content.data[params.data.sample]?.[readIndex]
          : undefined,

      valueSetter: (params) => {
        const sample = params.data.sample;
        dataset.content.data[sample]![readIndex] = params.newValue ? params.newValue : undefined;
        return true;
      },
    } as ColDef<FastqDatasetRow, ImportFileHandle>);

  return res;
});

const gridOptions: GridOptions<FastqDatasetRow> = {
  getRowId: (row) => row.data.sample ?? 'new',

  rowSelection: {
    mode: 'multiRow',
    checkboxes: false,
    headerCheckbox: false,
  },

  rowHeight: 45,

  getMainMenuItems: (_) => {
    return [];
  },

  getContextMenuItems: (params) => {
    if (getSelectedSamples(params.api, params.node).length === 0)
      return [];
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
