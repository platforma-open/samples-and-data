<script setup lang="ts">
import { ColDef, GridOptions } from 'ag-grid-enterprise';

import { AgGridVue } from 'ag-grid-vue3';

import {
  DatasetTaggedXsv,
  PlId,
  TaggedXsvDatasetRecord
} from '@platforma-open/milaboratories.samples-and-data.model';
import { ImportFileHandle } from '@platforma-sdk/model';
import { AgGridTheme, makeRowNumberColDef, PlAgCellFile } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from './app';
import { argsModel } from './lens';
import { agSampleIdComparator } from './util';

const app = useApp();
const datasetId = app.queryParams.id;

type TaggedXsvDatasetRow = {
  readonly key: string;
  readonly sample: PlId;
  readonly tags: Record<string, string>;
  readonly file: ImportFileHandle;
};

const dataset = argsModel(app, {
  get: (args) => args.datasets.find((ds) => ds.id === datasetId) as DatasetTaggedXsv,
  onDisconnected: () => app.navigateTo('/')
});

function encodeKey(tags: readonly string[], sampleId: PlId, r: TaggedXsvDatasetRecord): string {
  return JSON.stringify([sampleId, ...tags.map((t) => r.tags[t])]);
}

const rowData = computed(() => {
  const dsc = dataset.value.content;
  const result: TaggedXsvDatasetRow[] = Object.entries(dsc.data).flatMap(([sampleId, rs]) =>
    (rs ?? []).map((r) => ({
      key: encodeKey(dsc.tags, sampleId as PlId, r),
      sample: sampleId as PlId,
      tags: r.tags,
      file: r.file
    }))
  );
  // console.dir(result, { depth: 5 });
  return result;
});


const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true
};

const columnDefs = computed(() => {
  const sampleLabels = app.model.args.sampleLabels  as Record<string, string>;
  const sampleIdComparator = agSampleIdComparator(sampleLabels);
  const dsc = dataset.value.content;
  const res: ColDef<TaggedXsvDatasetRow>[] = [
    makeRowNumberColDef(),
    {
      headerName: app.model.args.sampleLabelColumnLabel,
      flex: 1,
      field: 'sample',
      editable: false,
      refData: sampleLabels,
      comparator: sampleIdComparator
    }
  ];


  for (const tag of dsc.tags)
    res.push({
      headerName: tag,
      field: `tags.${tag}`,
      flex: 1
    });

  res.push({
    headerName: 'File',
    field: 'file',
    flex: 2,
    cellStyle: { padding: 0 },

    cellRenderer: 'PlAgCellFile',
    cellRendererParams: {
      extensions: dsc.gzipped ? (dsc.xsvType ? [dsc.xsvType + '.gz'] : ['csv.gz', 'tsv.gz']) : (dsc.xsvType ? [dsc.xsvType] : ['csv', 'tsv']) ,
      resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
        const progresses = app.progresses;
        if (!fileHandle) return undefined;
        else return progresses[fileHandle];
      }
    }
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

const gridOptions: GridOptions<TaggedXsvDatasetRow> = {
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
    PlAgCellFile
  }
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
