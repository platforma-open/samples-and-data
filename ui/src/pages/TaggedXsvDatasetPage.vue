<script setup lang="ts">
import type { ColDef, GridOptions } from 'ag-grid-enterprise';

import { AgGridVue } from 'ag-grid-vue3';

import type {
  DSTaggedXsv,
  PlId,
  TaggedXsvDatasetRecord,
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
  return ds as DSTaggedXsv;
})();

type TaggedXsvDatasetRow = {
  readonly key: string;
  readonly sample: PlId;
  readonly tags: Record<string, string>;
  readonly file: ImportFileHandle;
};

function encodeKey(tags: readonly string[], sampleId: PlId, r: TaggedXsvDatasetRecord): string {
  return JSON.stringify([sampleId, ...tags.map((t) => r.tags[t])]);
}

const rowData = computed(() => Object.entries(dataset.content.data).flatMap(([sampleId, rs]) =>
  (rs ?? []).map((r) => ({
    key: encodeKey(dataset.content.tags, sampleId as PlId, r),
    sample: sampleId as PlId,
    tags: r.tags,
    file: r.file,
  })),
));

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const columnDefs = computed(() => {
  const dsc = dataset.content;
  const res: ColDef<TaggedXsvDatasetRow>[] = [
    makeRowNumberColDef(),
    agSampleIdColumnDef(app),
  ];

  for (const tag of dsc.tags)
    res.push({
      headerName: tag,
      field: `tags.${tag}`,
      flex: 1,
    });

  res.push({
    headerName: 'Data',
    field: 'file',
    flex: 2,
    cellStyle: { padding: 0 },
    headerComponent: PlAgColumnHeader,
    headerComponentParams: { type: 'File' } satisfies PlAgHeaderComponentParams,
    cellRenderer: 'PlAgCellFile',
    cellRendererParams: {
      extensions: dsc.gzipped ? (dsc.xsvType ? [dsc.xsvType + '.gz'] : ['csv.gz', 'tsv.gz']) : (dsc.xsvType ? [dsc.xsvType] : ['csv', 'tsv']),
      resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
        const progresses = app.progresses;
        if (!fileHandle) return undefined;
        else return progresses[fileHandle];
      },
    },
  });

  return res;
});

const gridOptions: GridOptions<TaggedXsvDatasetRow> = {
  getRowId: (row) => row.data.key,
  rowSelection: 'multiple',
  rowHeight: 45,
  getMainMenuItems: (_) => [],
  // @TODO implement context menu and deletion
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
