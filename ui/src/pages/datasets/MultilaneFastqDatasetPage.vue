<script setup lang="ts">
import type { ColDef, GridApi, GridOptions, IRowNode } from 'ag-grid-enterprise';

import { AgGridVue } from 'ag-grid-vue3';

import type {
  DatasetMultilaneFastq,
  FastqFileGroup,
  Lane,
} from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle, PlId } from '@platforma-sdk/model';
import { AgGridTheme, makeRowNumberColDef, PlAgCellFile } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../../app';
import { argsModel } from '../../lens';

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
  onDisconnected: () => app.navigateTo('/'),
});

function encodeKey(sampleId: PlId, lane: string): string {
  return JSON.stringify([sampleId, lane]);
}

// function decodeKey(key: string): [PlId, string] {
//   return JSON.parse(key);
// }

const rowData = computed(() => {
  const result: MultilaneFastaDatasetRow[] = Object.entries(dataset.value.content.data).flatMap(
    ([sampleId, lanes]) =>
      Object.entries(lanes!).map(([lane, fastqs]) => ({
        key: encodeKey(sampleId as PlId, lane),
        sample: sampleId as PlId,
        lane: lane,
        reads: fastqs!,
      })),
  );
  console.dir(result, { depth: 5 });
  return result;
});

const readIndices = computed(() => dataset.value.content.readIndices);

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const columnDefs = computed(() => {
  const sampleLabels = app.model.args.sampleLabels;
  const progresses = app.progresses;
  const res: ColDef<MultilaneFastaDatasetRow>[] = [
    makeRowNumberColDef(),
    {
      headerName: app.model.args.sampleLabelColumnLabel,
      flex: 1,
      field: 'sample',
      editable: false,
      refData: sampleLabels,
    } as ColDef<MultilaneFastaDatasetRow, PlId>,
    {
      headerName: 'Lane',
      flex: 1,
      field: 'lane',
      editable: false,
    } as ColDef<MultilaneFastaDatasetRow, string>,
  ];

  for (const readIndex of readIndices.value)
    res.push({
      headerName: readIndex,
      flex: 2,
      cellStyle: { padding: 0 },

      cellRenderer: 'PlAgCellFile',
      cellRendererParams: {
        extensions: dataset.value.content.gzipped ? ['fastq.gz', 'fq.gz'] : ['fastq', 'fq'],
        resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
          if (!fileHandle) return undefined;
          else return progresses[fileHandle];
        },
      },

      valueGetter: (params) =>
        params.data?.sample
          ? dataset.value.content.data[params.data.sample]![params.data.lane]![readIndex]
          : undefined,
      valueSetter: (params) => {
        const sample = params.data.sample;
        if (sample === '') return false;
        const lane = params.data.lane;
        dataset.update(
          (ds) =>
            (ds.content.data[sample]![lane]![readIndex] = params.newValue
              ? params.newValue
              : undefined),
        );
        return true;
      },
      suppressMenu: true,
    } as ColDef<MultilaneFastaDatasetRow, ImportFileHandle>);

  return res;
});

function getSelectedKeys(
  api: GridApi<MultilaneFastaDatasetRow>,
  node: IRowNode<MultilaneFastaDatasetRow> | null,
): [PlId, string][] {
  const keys = api.getSelectedRows().map((row) => [row.sample, row.lane] as [PlId, string]);
  if (keys.length !== 0) return keys;
  if (!node?.data) return [];
  return [[node.data.sample, node.data.lane]];
}

const gridOptions: GridOptions<MultilaneFastaDatasetRow> = {
  getRowId: (row) => row.data.key,
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
                delete ds.content.data[sampleId];
            }
          });
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
    :columnDefs="columnDefs"
    :defaultColDef="defaultColDef"
    :gridOptions="gridOptions"
  />
</template>
