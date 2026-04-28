<script setup lang="ts">
import type { ColDef, GridApi, GridOptions, GridReadyEvent } from 'ag-grid-enterprise';
import { ClientSideRowModelModule, MenuModule, ModuleRegistry, RichSelectModule } from 'ag-grid-enterprise';
import { AgGridVue } from 'ag-grid-vue3';
import type { DSMultiplexedFastq, PlId, ReadIndex } from '@platforma-open/milaboratories.samples-and-data.model';
import { validateMultiplexingRulesDataset } from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle } from '@platforma-sdk/model';
import type { PlAgHeaderComponentParams } from '@platforma-sdk/ui-vue';
import { AgGridTheme, makeRowNumberColDef, PlAgCellFile, PlAgColumnHeader, PlAlert, PlBtnGroup } from '@platforma-sdk/ui-vue';
import { computed, ref, shallowRef } from 'vue';
import { useApp } from '../app';
import MultiplexingRulesSection from '../components/MultiplexingRulesSection.vue';
import SyncDatasetDialog from '../dialogs/SyncDatasetDialog.vue';
import { agGroupIdColumnDef } from '../util';

ModuleRegistry.registerModules([ClientSideRowModelModule, RichSelectModule, MenuModule]);

const app = useApp();

const datasetId = app.queryParams.id;

const dataset = computed(() => {
  const ds = app.model.data.datasets.find((ds) => ds.id === datasetId);
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

type ViewMode = 'files' | 'rules';
const viewMode = ref<ViewMode>('files');
const viewOptions = [
  { label: 'File Groups', value: 'files' as const },
  { label: 'Multiplexing Rules', value: 'rules' as const },
];

const issues = computed(() =>
  validateMultiplexingRulesDataset(dataset.value, app.model.data.sampleLabels),
);

const alertSeverity = computed<'error' | 'warn' | undefined>(() => {
  if (issues.value.some((i) => i.severity === 'error')) return 'error';
  if (issues.value.length > 0) return 'warn';
  return undefined;
});
</script>

<template>
  <div class="multiplexed-fastq-page">
    <SyncDatasetDialog :dataset-ids="[datasetId as PlId]" />

    <PlAlert v-if="issues.length > 0" :type="alertSeverity">
      <ul class="multiplexed-fastq-page__issues">
        <li v-for="(issue, i) in issues" :key="i">{{ issue.message }}</li>
      </ul>
    </PlAlert>

    <div class="multiplexed-fastq-page__toolbar">
      <PlBtnGroup v-model="viewMode" :options="viewOptions" />
    </div>

    <div v-show="viewMode === 'files'" class="multiplexed-fastq-page__pane">
      <AgGridVue
        :theme="AgGridTheme"
        :style="{ height: '100%' }"
        :rowData="rowData"
        :defaultColDef="defaultColDef"
        :columnDefs="columnDefs"
        :gridOptions="gridOptions"
        @grid-ready="onGridReady"
      />
    </div>

    <div v-show="viewMode === 'rules'" class="multiplexed-fastq-page__pane">
      <MultiplexingRulesSection :dataset="dataset" />
    </div>
  </div>
</template>

<style scoped>
.multiplexed-fastq-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.multiplexed-fastq-page__toolbar {
  display: flex;
  justify-content: flex-end;
}

.multiplexed-fastq-page__pane {
  flex: 1 1 auto;
  min-height: 240px;
  display: flex;
  flex-direction: column;
}

.multiplexed-fastq-page__issues {
  margin: 0;
  padding-left: 18px;
}
</style>
