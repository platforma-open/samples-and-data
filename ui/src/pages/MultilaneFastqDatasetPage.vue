<script setup lang="ts">
import type { ColDef, GridApi, GridOptions, IRowNode } from 'ag-grid-enterprise';

import { AgGridVue } from 'ag-grid-vue3';

import type {
  DSMultilaneFastq,
  FastqFileGroup,
  Lane,
  PlId,
} from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle } from '@platforma-sdk/model';
import type { PlAgHeaderComponentParams } from '@platforma-sdk/ui-vue';
import { AgGridTheme, makeRowNumberColDef, PlAgCellFile, PlAgColumnHeader } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';
import { agSampleIdColumnDef } from '../util';

const app = useApp();

const datasetId = app.queryParams.id;

const dataset = (() => {
  const ds = app.model.args.datasets.find((ds) => ds.id === datasetId);
  if (!ds)
    throw new Error('Dataset not found');
  return ds as DSMultilaneFastq;
})();

type MultilaneFastaDatasetRow = {
  readonly key: string;
  readonly sample: PlId;
  readonly lane: Lane;
  readonly reads: FastqFileGroup;
};

function encodeKey(sampleId: PlId, lane: string): string {
  return JSON.stringify([sampleId, lane]);
}

const rowData = computed(() => Object.entries(dataset.content.data).flatMap(
  ([sampleId, lanes]) =>
    Object.entries(lanes!).map(([lane, fastqs]) => ({
      key: encodeKey(sampleId as PlId, lane),
      sample: sampleId as PlId,
      lane: lane,
      reads: fastqs!,
    })),
));

const readIndices = computed(() => dataset.content.readIndices);

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const columnDefs = computed(() => {
  const progresses = app.progresses;
  const res: ColDef<MultilaneFastaDatasetRow>[] = [
    makeRowNumberColDef(),
    agSampleIdColumnDef(app),
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
      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'File' } satisfies PlAgHeaderComponentParams,

      cellRenderer: 'PlAgCellFile',
      cellRendererParams: {
        extensions: dataset.content.gzipped ? ['fastq.gz', 'fq.gz'] : ['fastq', 'fq'],
        resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
          if (!fileHandle) return undefined;
          else return progresses[fileHandle];
        },
      },

      valueGetter: (params) =>
        params.data?.sample
          ? dataset.content.data[params.data.sample]![params.data.lane]![readIndex]
          : undefined,
      valueSetter: (params) => {
        const sample = params.data.sample;
        const lane = params.data.lane;
        dataset.content.data[sample]![lane]![readIndex] = params.newValue
          ? params.newValue
          : undefined;

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
  getMainMenuItems: (_) => {
    return [];
  },
  getContextMenuItems: (params) => {
    if (getSelectedKeys(params.api, params.node).length === 0) return [];
    return [
      {
        name: 'Delete',
        action: (params) => {
          const keysToDelete = getSelectedKeys(params.api, params.node);

          for (const [sampleId, lane] of keysToDelete) {
            delete dataset.content.data[sampleId]![lane];
            if (Object.keys(dataset.content.data[sampleId]!).length === 0)
              delete dataset.content.data[sampleId];
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
    :columnDefs="columnDefs"
    :defaultColDef="defaultColDef"
    :gridOptions="gridOptions"
  />
</template>
