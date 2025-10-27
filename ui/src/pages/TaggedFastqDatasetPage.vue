<script setup lang="ts">
import type { ColDef, GridOptions } from 'ag-grid-enterprise';

import { AgGridVue } from 'ag-grid-vue3';

import type {
  DSTaggedFastq,
  FastqFileGroup,
  Lane,
  PlId,
  TaggedDatasetRecord,
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
  return ds as DSTaggedFastq;
})();

type TaggedFastqDatasetRow = {
  readonly key: string;
  readonly sample: PlId;
  readonly lane?: Lane;
  readonly tags: Record<string, string>;
  readonly reads: FastqFileGroup;
};

function encodeKey(tags: readonly string[], sampleId: PlId, r: TaggedDatasetRecord): string {
  return JSON.stringify([sampleId, ...tags.map((t) => r.tags[t]), r.lane ?? '']);
}

const rowData = computed(() => Object.entries(dataset.content.data).flatMap(([sampleId, rs]) =>
  (rs ?? []).map((r) => ({
    key: encodeKey(dataset.content.tags, sampleId as PlId, r),
    sample: sampleId as PlId,
    lane: r.lane,
    tags: r.tags,
    reads: r.files,
  }))));

const readIndices = computed(() => dataset.content.readIndices);

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

const columnDefs = computed(() => {
  const dsc = dataset.content;
  const res: ColDef<TaggedFastqDatasetRow>[] = [
    makeRowNumberColDef(),
    agSampleIdColumnDef(app),
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

      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'File' } satisfies PlAgHeaderComponentParams,

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

const gridOptions: GridOptions<TaggedFastqDatasetRow> = {
  getRowId: (row) => row.data.key,
  rowHeight: 45,
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
