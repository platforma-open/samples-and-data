<script setup lang="ts">
import type { ColDef, GridOptions } from 'ag-grid-enterprise';

import { AgGridVue } from 'ag-grid-vue3';

import type {
  DatasetTaggedFastq,
  FastqFileGroup,
  Lane,
  TaggedDatasetRecord,
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
  readonly lane?: Lane;
  readonly tags: Record<string, string>;
  readonly reads: FastqFileGroup;
};

const dataset = argsModel(app, {
  get: (args) => args.datasets.find((ds) => ds.id === datasetId) as DatasetTaggedFastq,
  onDisconnected: () => app.navigateTo('/'),
});

function encodeKey(tags: readonly string[], sampleId: PlId, r: TaggedDatasetRecord): string {
  return JSON.stringify([sampleId, ...tags.map((t) => r.tags[t]), r.lane ?? '']);
}

const rowData = computed(() => {
  const dsc = dataset.value.content;
  const result: MultilaneFastaDatasetRow[] = Object.entries(dsc.data).flatMap(([sampleId, rs]) =>
    (rs ?? []).map((r) => ({
      key: encodeKey(dsc.tags, sampleId as PlId, r),
      sample: sampleId as PlId,
      lane: r.lane,
      tags: r.tags,
      reads: r.files,
    })),
  );
  // console.dir(result, { depth: 5 });
  return result;
});

const readIndices = computed(() => dataset.value.content.readIndices);

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const columnDefs = computed(() => {
  const sampleLabels = app.model.args.sampleLabels;
  const dsc = dataset.value.content;
  const res: ColDef<MultilaneFastaDatasetRow>[] = [
    makeRowNumberColDef(),
    {
      headerName: app.model.args.sampleLabelColumnLabel,
      flex: 1,
      field: 'sample',
      editable: false,
      refData: sampleLabels as Record<string, string>,
    },
  ];

  if (dsc.hasLanes)
    res.push({
      headerName: 'Lane',
      flex: 1,
      field: 'lane',
      editable: false,
    });

  for (const tag of dsc.tags)
    res.push({
      headerName: tag,
      field: `tags.${tag}`,
      flex: 1,
    });

  for (const readIndex of readIndices.value)
    res.push({
      headerName: readIndex,
      field: `reads.${readIndex}`,
      flex: 2,
      cellStyle: { padding: 0 },

      cellRenderer: 'PlAgCellFile',
      cellRendererParams: {
        extensions: dsc.gzipped ? ['fastq.gz', 'fq.gz'] : ['fastq', 'fq'],
        resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
          const progresses = app.progresses;
          if (!fileHandle) return undefined;
          else return progresses[fileHandle];
        },
      },
    });

  return res;
});

// function isPlId(v: PlId | ''): v is PlId {
//   return v !== '';
// }

// function getSelectedKeys(
//   api: GridApi<MultilaneFastaDatasetRow>,
//   node: IRowNode<MultilaneFastaDatasetRow> | null
// ): [PlId, string][] {
//   const keys = api.getSelectedRows().map((row) => [row.sample, row.lane] as [PlId, string]);
//   if (keys.length !== 0) return keys;
//   const sample = node?.data?.sample;
//   if (!node?.data) return [];
//   return [[node.data.sample, node.data.lane]];
// }

const gridOptions: GridOptions<MultilaneFastaDatasetRow> = {
  getRowId: (row) => row.data.key,
  // rowSelection: 'multiple',
  rowHeight: 45,
  // getMainMenuItems: (params) => {
  //   return [];
  // },
  // getContextMenuItems: (params) => {
  //   if (getSelectedKeys(params.api, params.node).length === 0) return [];
  //   return [
  //     {
  //       name: 'Delete',
  //       action: (params) => {
  //         const keysToDelete = getSelectedKeys(params.api, params.node);
  //         dataset.update((ds) => {
  //           for (const [sampleId, lane] of keysToDelete) {
  //             delete ds.content.data[sampleId]![lane];
  //             if (Object.keys(ds.content.data[sampleId]!).length === 0)
  //               delete ds.content.data[sampleId];
  //           }
  //         });
  //       }
  //     }
  //   ];
  // },
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
