<script setup lang="ts">

import {
  ColDef,
  GridApi,
  GridOptions,
  IRowNode,
} from '@ag-grid-community/core';

import { AgGridVue } from '@ag-grid-community/vue3';

import {
  DatasetMultilaneFastq,
  FastqFileGroup,
  Lane,
  PlId
} from '@platforma-open/milaboratories.samples-and-data.model';
import { ImportFileHandle } from '@platforma-sdk/model';
import { AgGridTheme, PlAgCellFile } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from './app';
import { argsModel } from './lens';

const app = useApp();
const datasetId = app.queryParams.id;

type MultilaneFastaDatasetRow = {
  readonly key: string;
  readonly sample: PlId;
  readonly lane: Lane;
  readonly reads: FastqFileGroup;
};

const dataset = argsModel(app, {
  get: (args) => args.datasets.find((ds) => ds.id === datasetId) as DatasetMultilaneFastq,
  onDisconnected: () => app.navigateTo('/')
});

function encodeKey(sampleId: PlId, lane: string): string {
  return JSON.stringify([sampleId, lane])
}

function decodeKey(key: string): [PlId, string] {
  return JSON.parse(key)
}

const rowData = computed(() => {
  const result: MultilaneFastaDatasetRow[] = Object.entries(dataset.value.content.data).flatMap(
    ([sampleId, lanes]) => Object.entries(lanes!).map(
      ([lane, fastqs]) => ({
        key: encodeKey(sampleId as PlId, lane),
        sample: sampleId as PlId,
        lane: lane,
        reads: fastqs!
      })
    )
  );
  console.dir(result, { depth: 5 });
  return result;
});

const readIndices = computed(() => dataset.value.content.readIndices);

const columnDefs = computed(() => {
  const sampleLabels = app.model.args.sampleLabels;
  const res: ColDef<MultilaneFastaDatasetRow>[] = [
    {
      headerName: app.model.args.sampleLabelColumnLabel,
      flex: 1,
      field: 'sample',
      editable: false,
      refData: sampleLabels
    } as ColDef<MultilaneFastaDatasetRow, PlId>,
    {
      headerName: 'Lane',
      flex: 1,
      field: 'lane',
      editable: false
    } as ColDef<MultilaneFastaDatasetRow, string>,
  ];

  for (const readIndex of readIndices.value)
    res.push({
      headerName: readIndex,
      flex: 2,
      cellStyle: { padding: 0 },

      cellRenderer: 'PlAgCellFile',
      cellRendererParams: {
        extensions: dataset.value.content.gzipped ? ['fastq.gz'] : ['fastq'],
        resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
          const progresses = app.progresses;
          if (!fileHandle) return undefined;
          else return progresses[fileHandle];
        }
      },

      valueGetter: (params) =>
        params.data?.sample
          ? dataset.value.content.data[params.data.sample]![params.data.lane]![readIndex]
          : undefined,
      valueSetter: (params) => {
        const sample = params.data.sample;
        if (sample === '') return false;
        const lane = params.data.lane;
        dataset.update((ds) => (ds.content.data[sample]![lane]![readIndex] = params.newValue ? params.newValue : undefined));
        return true;
      },
      suppressMenu: true
    } as ColDef<MultilaneFastaDatasetRow, ImportFileHandle>);

  return res;
});

function isPlId(v: PlId | ''): v is PlId {
  return v !== '';
}

function getSelectedKeys(
  api: GridApi<MultilaneFastaDatasetRow>,
  node: IRowNode<MultilaneFastaDatasetRow> | null
): [PlId, string][] {
  const keys = api
    .getSelectedRows()
    .map((row) => [row.sample, row.lane] as [PlId, string]);
  if (keys.length !== 0) return keys;
  const sample = node?.data?.sample;
  if (!node?.data) return [];
  return [[node.data.sample, node.data.lane]];
}

const gridOptions: GridOptions<MultilaneFastaDatasetRow> = {
  getRowId: (row) => row.data.key,
  rowSelection: 'multiple',
  rowHeight: 45,
  getMainMenuItems: (params) => {
    return [];
  },
  getContextMenuItems: (params) => {
    if (getSelectedKeys(params.api, params.node).length === 0) return [];
    return [
      {
        name: 'Delete',
        action: (params) => {
          const keysToDelete = getSelectedKeys(params.api, params.node);
          dataset.update((ds) => {
            for (const [sampleId, lane] of keysToDelete) {
              delete ds.content.data[sampleId]![lane];
              if (Object.keys(ds.content.data[sampleId]!).length === 0)
                delete ds.content.data[sampleId]
            };
          });
        }
      }
    ];
  },
  components: {
    PlAgCellFile
  }
};
</script>

<template>
  <AgGridVue :theme="AgGridTheme" :style="{ height: '100%' }" :rowData="rowData" :columnDefs="columnDefs"
    :gridOptions="gridOptions" />
</template>
