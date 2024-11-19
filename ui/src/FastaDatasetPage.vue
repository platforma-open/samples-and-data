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
  DatasetFasta,
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

type FastaDatasetRow = {
  // undefined for an empty row at the end of the table
  readonly sample: PlId | '';
  readonly data?: ImportFileHandle | null;
};

function nullToUndefined<T>(value: T | undefined | null): T | undefined {
  return value === null ? undefined : value;
}

function undefinedToNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

const dataset = argsModel(app, {
  get: (args) => args.datasets.find((ds) => ds.id === datasetId) as DatasetFasta,
  onDisconnected: () => app.navigateTo('/')
});

const unusedIds = () => {
  const usedIds = new Set(Object.keys(dataset.value.content.data));
  return app.args.sampleIds.filter((id) => !usedIds.has(id));
};

const rowData = computed(() => {
  const result: FastaDatasetRow[] = Object.entries(dataset.value.content.data).map(
    ([sampleId, data]) => ({
      sample: sampleId as PlId,
      data
    })
  );
  if (unusedIds().length > 0) result.push({ sample: '' });
  return result;
});

const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true
}

const columnDefs = computed(() => {
  const sampleLabels = app.args.sampleLabels;
  const res: ColDef<FastaDatasetRow>[] = [
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
        dataset.update((ds) => (ds.content.data[params.newValue] = null));
        return true;
      },
      cellEditor: 'agRichSelectCellEditor',
      refData: { ...sampleLabels, '': '+ add sample' },
      singleClickEdit: true,
      cellEditorParams: {
        values: unusedIds,
      } satisfies IRichCellEditorParams<FastaDatasetRow>,
      pinned: 'left',
      lockPinned: true
    }
  ];

  res.push({
    headerName: "Fasta file",
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
            extensions: dataset.value.content.gzipped ? ['fasta.gz'] : ['fasta']
          }
        }
        : undefined,
    valueGetter: (params) =>
      params.data?.sample
        ? nullToUndefined(dataset.value.content.data[params.data.sample])
        : undefined,
    valueSetter: (params) => {
      const sample = params.data.sample;
      if (sample === '') return false;
      dataset.update((ds) => ds.content.data[sample] = nullToUndefined(params.newValue));
      return true;
    }
  } as ColDef<FastaDatasetRow, ImportFileHandle>);

  return res;
});

function isPlId(v: PlId | ''): v is PlId {
  return v !== '';
}

function getSelectedSamples(
  api: GridApi<FastaDatasetRow>,
  node: IRowNode<FastaDatasetRow> | null
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

const gridOptions: GridOptions<FastaDatasetRow> = {
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
  <AgGridVue :theme="AgGridTheme" :style="{ height: '100%' }" :rowData="rowData" :defaultColDef="defaultColDef"
    :columnDefs="columnDefs" :gridOptions="gridOptions" />
</template>
