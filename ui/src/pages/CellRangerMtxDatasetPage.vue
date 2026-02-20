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
  CellRangerMtxFileGroup,
  DSCellRangerMtx,
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
  return ds as DSCellRangerMtx;
})();

type CellRangerMtxDatasetRow = {
  readonly sample: PlId;
  readonly files: CellRangerMtxFileGroup;
};

const rowData = computed(() => Object.entries(dataset.content.data).map(
  ([sampleId, files]) => ({
    sample: sampleId as PlId,
    files: files!,
  })));

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const roleConfig = computed(() => [
  {
    role: 'matrix.mtx' as const,
    label: 'Matrix',
    extensions: dataset.content.gzipped ? ['mtx.gz'] : ['mtx'],
  },
  {
    role: 'features.tsv' as const,
    label: 'Features',
    extensions: dataset.content.gzipped ? ['tsv.gz'] : ['tsv'],
  },
  {
    role: 'barcodes.tsv' as const,
    label: 'Barcodes',
    extensions: dataset.content.gzipped ? ['tsv.gz'] : ['tsv'],
  },
]);

const columnDefs = computed(() => {
  const progresses = app.progresses;

  const res: ColDef<CellRangerMtxDatasetRow>[] = [
    makeRowNumberColDef(),
    agSampleIdColumnDef(app),
  ];

  for (const { role, label, extensions } of roleConfig.value)
    res.push({
      headerName: label,
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
                extensions,
              },
            }
          : undefined,

      valueGetter: (params) =>
        params.data?.sample
          ? dataset.content.data[params.data.sample]?.[role]
          : undefined,

      valueSetter: (params) => {
        const sample = params.data.sample;
        if (!dataset.content.data[sample])
          dataset.content.data[sample] = {};
        dataset.content.data[sample]![role] = params.newValue ? params.newValue : undefined;
        return true;
      },
    } as ColDef<CellRangerMtxDatasetRow, ImportFileHandle>);

  return res;
});

const gridOptions: GridOptions<CellRangerMtxDatasetRow> = {
  getRowId: (row) => row.data.sample,

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

