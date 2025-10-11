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

import type { DSBulkCountMatrix, PlId } from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle } from '@platforma-sdk/model';
import { AgGridTheme, makeRowNumberColDef, PlAgCellFile } from '@platforma-sdk/ui-vue';
import * as _ from 'radashi';
import { computed, watch } from 'vue';
import { useApp } from '../app';
import { getOrCreateSample } from '../dialogs/datasets';
import { agGroupIdColumnDef, agSampleIdColumnDef } from '../util';

ModuleRegistry.registerModules([ClientSideRowModelModule, RichSelectModule, MenuModule]);

const app = useApp();

const datasetId = app.queryParams.id;

const dataset = computed(() => {
  const ds = app.model.args.datasets.find((ds) => ds.id === datasetId);
  if (!ds)
    throw new Error('Dataset not found');
  return ds as DSBulkCountMatrix;
});

watch(() => (app.model.outputs.sampleGroups), (sampleGroups) => {
  const sg = sampleGroups?.[datasetId];
  if (sg) {
    // update data
    const groupToSample = {} as Record<PlId, PlId[]>;
    for (const [groupId, samples] of Object.entries(sg)) {
      if (!samples) return;
      const sampleIds = [];
      for (const sampleLabel of samples) {
        const sampleId = getOrCreateSample(app, sampleLabel);
        sampleIds.push(sampleId);
      }
      groupToSample[groupId as PlId] = sampleIds;
    }
    if (!_.isEqual(dataset.value.content.groupToSample, groupToSample)) {
      dataset.value.content.groupToSample = groupToSample;
    }
  }
}, { immediate: true });

const groupToSample = computed(() => dataset.value.content.groupToSample);

const isLoading = computed(() => groupToSample.value === undefined);

type DatasetRow = {
  // undefined for an empty row at the end of the table
  readonly group: PlId;
  readonly sample: PlId;
  readonly data?: ImportFileHandle | null;
};

const rowData = computed(() => {
  return Object.entries(dataset.value.content.data).flatMap(
    ([groupId, data]) => groupToSample.value![groupId as PlId]!.map((sampleId) => (
      {
        group: groupId as PlId,
        sample: sampleId as PlId,
        data,
      }
    )),
  );
});

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const columnDefs = computed((): ColDef<DatasetRow>[] => {
  return [
    makeRowNumberColDef(),
    agSampleIdColumnDef(app),
    agGroupIdColumnDef(app),
    {
      headerName: 'Data',
      flex: 2,
      cellStyle: { padding: 0 },
      spanRows: true,

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
                extensions: dataset.value.content.gzipped ? (dataset.value.content.xsvType ? [dataset.value.content.xsvType + '.gz'] : ['csv.gz', 'tsv.gz']) : (dataset.value.content.xsvType ? [dataset.value.content.xsvType] : ['csv', 'tsv']),
              },
            }
          : undefined,
      valueGetter: (params) =>
        params.data?.group
          ? dataset.value.content.data[params.data.group]
          : undefined,
      valueSetter: (params) => {
        const group = params.data.group;
        dataset.value.content.data[group] = params.newValue ?? null;
        return true;
      },
    }];
});

const gridOptions: GridOptions<DatasetRow> = {
  getRowId: (row) => row.data.sample ?? 'new',
  rowSelection: {
    mode: 'multiRow',
    checkboxes: false,
    headerCheckbox: false,
  },
  rowHeight: 45,
  getMainMenuItems: () => {
    return [];
  },
  // getContextMenuItems: (params) => {
  // if (getSelectedSamples(params.api, params.node).length === 0) return [];
  // return [
  //   {
  //     name: 'Delete',
  //     action: (params) => {
  //       const samplesToDelete = getSelectedSamples(params.api, params.node);
  //       for (const s of samplesToDelete)
  //         delete dataset.content.data[s];
  //     },
  //   },
  // ];
  // },
  components: {
    PlAgCellFile,
  },
  enableCellSpan: true,
};
</script>

<template>
  <div v-if="isLoading">
    Extracting samples...
  </div>

  <AgGridVue
    v-else
    :theme="AgGridTheme"
    :style="{ height: '100%' }"
    :rowData="rowData"
    :defaultColDef="defaultColDef"
    :columnDefs="columnDefs"
    :gridOptions="gridOptions"
  />
</template>
