<script setup lang="ts">
import type { ColDef, GridApi, GridOptions, GridReadyEvent } from 'ag-grid-enterprise';
import { ClientSideRowModelModule, MenuModule, ModuleRegistry, RichSelectModule } from 'ag-grid-enterprise';
import { AgGridVue } from 'ag-grid-vue3';
import type { DSMultiplexedFastq, PlId, ReadIndex } from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle } from '@platforma-sdk/model';
import type { PlAgHeaderComponentParams } from '@platforma-sdk/ui-vue';
import { AgGridTheme, makeRowNumberColDef, PlAgCellFile, PlAgColumnHeader } from '@platforma-sdk/ui-vue';
import { computed, shallowRef } from 'vue';
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
  return ds as DSMultiplexedFastq;
});

const gridApi = shallowRef<GridApi<DatasetRow>>();

const onGridReady = (params: GridReadyEvent) => {
  gridApi.value = params.api;
};

type DatasetRow = {
  readonly groupId: PlId;
  readonly groupLabel: string;
  // number of samples in the group
  readonly nSamples: number;
  readonly reads: Partial<Record<ReadIndex, ImportFileHandle>>;
};

const rowData = computed(() => {
  // For MultiplexedFastq, read samples directly from content.sampleGroups (not from outputs)
  // One row per group, with all read indices as separate columns
  return Object.entries(dataset.value.content.data).map(
    ([groupId, fileGroup]) => ({
      groupId: groupId as PlId,
      groupLabel: dataset.value.content.groupLabels[groupId as PlId],
      nSamples: dataset.value.content.sampleGroups?.[groupId as PlId]
        ? Object.keys(dataset.value.content.sampleGroups[groupId as PlId]).length
        : 0,
      reads: fileGroup,
    }),
  );
});

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const columnDefs = computed(() => {
  const progresses = app.progresses;
  const res: ColDef<DatasetRow>[] = [
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
  ];

  // Add one column for each read index (R1, R2, etc.)
  for (const readIndex of dataset.value.content.readIndices) {
    res.push({
      headerName: readIndex,
      flex: 2,
      cellStyle: { padding: 0 },
      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'File' } satisfies PlAgHeaderComponentParams,

      cellRendererParams: {
        resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
          if (!fileHandle) return undefined;
          else return progresses[fileHandle];
        },
      },

      cellRendererSelector: (params) =>
        params.data?.groupId
          ? {
              component: 'PlAgCellFile',
              params: {
                extensions: dataset.value.content.gzipped ? ['fastq.gz', 'fq.gz'] : ['fastq', 'fq'],
              },
            }
          : undefined,

      valueGetter: (params) =>
        params.data?.groupId
          ? dataset.value.content.data[params.data.groupId]?.[readIndex]
          : undefined,

      valueSetter: (params) => {
        const groupId = params.data.groupId;
        if (!dataset.value.content.data[groupId]) {
          dataset.value.content.data[groupId] = {};
        }
        dataset.value.content.data[groupId][readIndex] = params.newValue ? params.newValue : undefined;
        return true;
      },
    } as ColDef<DatasetRow, ImportFileHandle>);
  }

  return res;
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
    @grid-ready="onGridReady"
  />
</template>
