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

import type { DSMultiSampleH5ad, PlId } from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle } from '@platforma-sdk/model';
import { AgGridTheme, makeRowNumberColDef, PlAgCellFile, PlAgColumnHeader } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';
import SyncDatasetDialog from '../dialogs/SyncDatasetDialog.vue';
import { agGroupIdColumnDef } from '../util';

ModuleRegistry.registerModules([ClientSideRowModelModule, RichSelectModule, MenuModule]);

const app = useApp();

const datasetId = app.queryParams.id;

const dataset = computed(() => {
  const ds = app.model.args.datasets.find((ds) => ds.id === datasetId);
  if (!ds)
    throw new Error('Dataset not found');
  return ds as DSMultiSampleH5ad;
});

type DatasetRow = {
  readonly groupId: PlId;
  readonly groupLabel: string;
  readonly nSamples: number | undefined;
  readonly data?: ImportFileHandle | null;
};

const rowData = computed(() => {
  const groupToSample = app.model.outputs.sampleGroups?.[dataset.value.id];
  return Object.entries(dataset.value.content.data).flatMap(
    ([groupId, data]) => (
      {
        groupId: groupId as PlId,
        groupLabel: dataset.value.content.groupLabels[groupId as PlId],
        nSamples: groupToSample?.[groupId as PlId]?.length,
        data,
      }
    ),
  );
});

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const columnDefs = computed((): ColDef<DatasetRow>[] => {
  return [
    makeRowNumberColDef(),
    {
      headerName: 'Samples',
      flex: 1,
      valueGetter: (params) => params.data?.nSamples,
      editable: false,
      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'Number' },
    },
    agGroupIdColumnDef(),
    {
      headerName: 'H5AD file',
      flex: 2,
      cellStyle: { padding: 0 },
      spanRows: true,

      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'File' },

      cellRendererParams: {
        resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
          const progresses = app.progresses;
          if (!fileHandle) return undefined;
          else return progresses[fileHandle];
        },
      },

      cellRendererSelector: (_) =>
        ({
          component: 'PlAgCellFile',
          params: {
            extensions: ['h5ad'],
          },
        }),
      valueGetter: (params) =>
        params.data?.groupId
          ? dataset.value.content.data[params.data.groupId]
          : undefined,
      valueSetter: (params) => {
        const group = params.data.groupId;
        const oldValue = dataset.value.content.data[group];
        const newValue = params.newValue ?? null;

        // Update the dataset data
        dataset.value.content.data[group] = newValue;

        // Update h5adFilesToPreprocess
        if (oldValue && oldValue !== newValue) {
          // Remove old file from h5adFilesToPreprocess
          const index = app.model.args.h5adFilesToPreprocess.indexOf(oldValue);
          if (index !== -1) {
            app.model.args.h5adFilesToPreprocess.splice(index, 1);
          }
        }
        if (newValue && newValue !== oldValue) {
          // Add new file to h5adFilesToPreprocess if not already present
          if (!app.model.args.h5adFilesToPreprocess.includes(newValue)) {
            app.model.args.h5adFilesToPreprocess.push(newValue);
          }
        }

        return true;
      },
    }];
});

const gridOptions: GridOptions<DatasetRow> = {
  getRowId: (row) => row.data.groupId,
  rowSelection: {
    mode: 'multiRow',
    checkboxes: false,
    headerCheckbox: false,
  },
  rowHeight: 45,
  getMainMenuItems: () => {
    return [];
  },
  components: {
    PlAgCellFile,
  },
  enableCellSpan: true,
};
</script>

<template>
  <SyncDatasetDialog :dataset-ids="[datasetId as PlId]" />

  <AgGridVue
    :theme="AgGridTheme"
    :style="{ height: '100%' }"
    :rowData="rowData"
    :defaultColDef="defaultColDef"
    :columnDefs="columnDefs"
    :gridOptions="gridOptions"
  />
</template>

