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

import type { DSSeurat, PlId } from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle } from '@platforma-sdk/model';
import type { PlAgHeaderComponentParams } from '@platforma-sdk/ui-vue';
import { AgGridTheme, makeRowNumberColDef, PlAgCellFile, PlAgColumnHeader } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';
import { agSampleIdColumnDef, getSelectedSamples } from '../util';

ModuleRegistry.registerModules([ClientSideRowModelModule, RichSelectModule, MenuModule]);

type SeuratDatasetRow = {
  readonly sample: PlId;
  readonly data?: ImportFileHandle | null;
};

const app = useApp();

const datasetId = app.queryParams.id;

const dataset = (() => {
  const ds = app.model.args.datasets.find((ds) => ds.id === datasetId);
  if (!ds)
    throw new Error('Dataset not found');
  return ds as DSSeurat;
})();

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
  const res: ColDef<SeuratDatasetRow>[] = [
    makeRowNumberColDef(),
    agSampleIdColumnDef(app),
  ];

  res.push({
    headerName: 'Seurat RDS file',
    flex: 2,
    cellStyle: { padding: 0 },

    headerComponent: PlAgColumnHeader,
    headerComponentParams: { type: 'File' } satisfies PlAgHeaderComponentParams,

    cellRendererParams: {
      resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
        if (!fileHandle)
          return undefined;
        else
          return app.progresses[fileHandle];
      },
    },

    cellRendererSelector: (params) =>
      params.data?.sample
        ? {
            component: 'PlAgCellFile',
            params: {
              extensions: ['rds', 'RDS'],
            },
          }
        : undefined,
    valueGetter: (params) => params.data?.sample ? dataset.content.data[params.data.sample] : undefined,
    valueSetter: (params) => {
      const sample = params.data.sample;
      const oldValue = dataset.content.data[sample];
      const newValue = params.newValue ?? null;

      // Update the dataset data
      dataset.content.data[sample] = newValue;

      // Update seuratFilesToPreprocess
      if (oldValue && oldValue !== newValue) {
        // Remove old file from seuratFilesToPreprocess
        const index = app.model.args.seuratFilesToPreprocess.indexOf(oldValue);
        if (index !== -1) {
          app.model.args.seuratFilesToPreprocess.splice(index, 1);
        }
      }
      if (newValue && newValue !== oldValue) {
        // Add new file to seuratFilesToPreprocess if not already present
        if (!app.model.args.seuratFilesToPreprocess.includes(newValue)) {
          app.model.args.seuratFilesToPreprocess.push(newValue);
        }
      }

      return true;
    },
  } as ColDef<SeuratDatasetRow, ImportFileHandle>);

  return res;
});

const gridOptions: GridOptions<SeuratDatasetRow> = {
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
    if (getSelectedSamples(params.api, params.node).length === 0) return [];
    return [
      {
        name: 'Delete',
        action: (params) => {
          const samplesToDelete = getSelectedSamples(params.api, params.node);
          for (const s of samplesToDelete) {
            // Get the file handle before deleting
            const fileHandle = dataset.content.data[s];
            
            // Delete from dataset
            delete dataset.content.data[s];
            
            // Remove from seuratFilesToPreprocess if present
            if (fileHandle) {
              const index = app.model.args.seuratFilesToPreprocess.indexOf(fileHandle);
              if (index !== -1) {
                app.model.args.seuratFilesToPreprocess.splice(index, 1);
              }
            }
          }
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


