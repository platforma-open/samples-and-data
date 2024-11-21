<script setup lang="ts">
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import {
  ColDef,
  GridApi,
  GridOptions,
  IRichCellEditorParams,
  IRowNode,
  ModuleRegistry
} from '@ag-grid-community/core';
import { MenuModule } from '@ag-grid-enterprise/menu';
import { RichSelectModule } from '@ag-grid-enterprise/rich-select';

import { AgGridVue } from '@ag-grid-community/vue3';

import {
  DatasetFastq,
  FastqFileGroup,
  PlId
} from '@platforma-open/milaboratories.samples-and-data.model';
import { ImportFileHandle } from '@platforma-sdk/model';
import { AgGridTheme, PlAgCellFile } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from './app';
import { argsModel } from './lens';

ModuleRegistry.registerModules([ClientSideRowModelModule, RichSelectModule, MenuModule]);

const app = useApp();
const datasetId = app.queryParams.id;

type FastqDatasetRow = {
  // undefined for an empty row at the end of the table
  readonly sample: PlId | '';
  readonly reads: FastqFileGroup;
};

const dataset = argsModel(app, {
  get: (args) => args.datasets.find((ds) => ds.id === datasetId) as DatasetFastq,
  onDisconnected: () => app.navigateTo('/')
});

const unusedIds = () => {
  const usedIds = new Set(Object.keys(dataset.value.content.data));
  return app.args.sampleIds.filter((id) => !usedIds.has(id));
};

const rowData = computed(() => {
  const result: FastqDatasetRow[] = Object.entries(dataset.value.content.data).map(
    ([sampleId, fastqs]) => ({
      sample: sampleId as PlId,
      reads: fastqs!
    })
  );
  if (unusedIds().length > 0) result.push({ sample: '', reads: {} });
  return result;
});

const readIndices = computed(() => dataset.value.content.readIndices);

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true
};

const columnDefs = computed(() => {
  const sampleLabels = app.args.sampleLabels;
  const res: ColDef<FastqDatasetRow>[] = [
    {
      headerName: app.model.args.sampleLabelColumnLabel,
      flex: 1,
      valueGetter: (params) => params.data?.sample,
      editable: (params) => {
        // only creating new records
        return params.data?.sample === '';
      },
      valueSetter: (params) => {
        if (params.oldValue !== '') throw new Error('Unexpected edit');
        if (!params.newValue) return false;
        dataset.update((ds) => (ds.content.data[params.newValue] = {}));
        return true;
      },
      cellEditor: 'agRichSelectCellEditor',
      refData: { ...sampleLabels, '': '+ add sample' },
      singleClickEdit: true,
      cellEditorParams: {
        values: unusedIds
      } satisfies IRichCellEditorParams<FastqDatasetRow>,
      pinned: 'left',
      lockPinned: true
    }
  ];

  for (const readIndex of readIndices.value)
    res.push({
      headerName: readIndex,
      flex: 2,
      cellStyle: { padding: 0 },

      cellRendererParams: {
        resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
          const progresses = app.progresses;
          if (!fileHandle) return undefined;
          else return progresses[fileHandle];
        }
      },

      cellRendererSelector: (params) =>
        params.data?.sample
          ? {
              component: 'PlAgCellFile',
              params: {
                extensions: dataset.value.content.gzipped ? ['fastq.gz'] : ['fastq']
              }
            }
          : undefined,
      valueGetter: (params) =>
        params.data?.sample
          ? dataset.value.content.data[params.data.sample]![readIndex]
          : undefined,
      valueSetter: (params) => {
        const sample = params.data.sample;
        if (sample === '') return false;
        dataset.update(
          (ds) =>
            (ds.content.data[sample]![readIndex] = params.newValue ? params.newValue : undefined)
        );
        return true;
      }
    } as ColDef<FastqDatasetRow, ImportFileHandle>);

  return res;
});

function isPlId(v: PlId | ''): v is PlId {
  return v !== '';
}

function getSelectedSamples(
  api: GridApi<FastqDatasetRow>,
  node: IRowNode<FastqDatasetRow> | null
): PlId[] {
  const samples = api
    .getSelectedRows()
    .map((row) => row.sample)
    .filter(isPlId);
  if (samples.length !== 0) return samples;
  const sample = node?.data?.sample;
  if (!sample) return [];
  return [sample];
}

const gridOptions: GridOptions<FastqDatasetRow> = {
  getRowId: (row) => row.data.sample ?? 'new',
  rowSelection: 'multiple',
  rowHeight: 45,
  getMainMenuItems: (params) => {
    return [];
  },
  getContextMenuItems: (params) => {
    if (getSelectedSamples(params.api, params.node).length === 0) return [];
    return [
      {
        name: 'Delete',
        action: (params) => {
          const samplesToDelete = getSelectedSamples(params.api, params.node);
          dataset.update((ds) => {
            for (const s of samplesToDelete) delete ds.content.data[s];
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
  <AgGridVue
    :theme="AgGridTheme"
    :style="{ height: '100%' }"
    :rowData="rowData"
    :defaultColDef="defaultColDef"
    :columnDefs="columnDefs"
    :gridOptions="gridOptions"
  />
</template>
