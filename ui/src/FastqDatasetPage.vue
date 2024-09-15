<script setup lang="ts">
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';

import {
  ColDef,
  GridApi,
  GridOptions,
  IRichCellEditorParams,
  IRowNode,
  ModuleRegistry
} from '@ag-grid-community/core';
import {
  RichSelectModule
} from '@ag-grid-enterprise/rich-select';
import {
  MenuModule
} from '@ag-grid-enterprise/menu';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';

import { AgGridVue } from '@ag-grid-community/vue3';

import {
  DatasetFastq,
  FastqFileGroup,
  PlId
} from '@milaboratory/milaboratories.samples-and-data.model';
import FileCell from './FileCell.vue';
import { computed } from 'vue';
import { useApp } from './app';
import { argsModel } from './lens';
import { isDefined } from '@milaboratory/sdk-vue';

ModuleRegistry.registerModules([ClientSideRowModelModule, RichSelectModule, MenuModule]);

const app = useApp();
const datasetId = app.queryParams.id;

type FastaDatasetRow = {
  // undefined for an empty row at the end of the table
  readonly sample: PlId | "";
  readonly reads: FastqFileGroup;
};

const dataset = argsModel(app, {
  get: args => args.datasets.find((ds) => ds.id === datasetId) as DatasetFastq,
  onDisconnected: () => app.navigateTo('/')
})

const unusedIds = () => {
  const usedIds = new Set(Object.keys(dataset.value.content.data));
  return app.args.sampleIds.filter(id => !usedIds.has(id));
}

const rowData = computed(() => {
  const result: FastaDatasetRow[] = Object.entries(dataset.value.content.data).map(([sampleId, fastqs]) => ({
    sample: sampleId as PlId,
    reads: fastqs!
  }))
  if (unusedIds().length > 0)
    result.push({ sample: "", reads: {} })
  return result;
});

const readIndices = computed(() => dataset.value.content.readIndices);

const columnDefs = computed(() => {
  const sampleLabels = app.args.sampleLabels;
  const res: ColDef<FastaDatasetRow>[] = [
    {
      headerName: "Sample",
      flex: 1,
      valueGetter: (params) => params.data?.sample,
      editable: (params) => {
        // only creating new records
        return params.data?.sample === "";
      },
      valueSetter: (params) => {
        if (params.oldValue !== "") throw new Error('Unexpected edit');
        if (!params.newValue)
          return false;
        dataset.update(ds => ds.content.data[params.newValue] = {})
        return true;
      },
      cellEditor: 'agRichSelectCellEditor',
      refData: { ...sampleLabels, "": "+ add sample" },
      singleClickEdit: true,
      cellEditorParams: {
        values: unusedIds,
      } satisfies IRichCellEditorParams<FastaDatasetRow>
    }
  ];

  for (const readIndex of readIndices.value)
    res.push({
      headerName: readIndex,
      flex: 2,
      cellRendererSelector: (params) =>
        params.data?.sample ? {
          component: 'FileCell', params: {
            extensions: dataset.value.content.gzipped ? ["fastq.gz"] : ["fastq"]
          }
        } : undefined,
      valueGetter: (params) =>
        params.data?.sample
          ? dataset.value.content.data[params.data.sample]![readIndex]
          : undefined,
      valueSetter: (params) => {
        const sample = params.data.sample;
        if (sample === "")
          return false;
        dataset.update(ds => ds.content.data[sample]![readIndex] = params.newValue)
        return true;
      }
    });

  return res;
});

function isPlId(v: PlId | ""): v is PlId {
  return v !== "";
}

function getSelectedSamples(api: GridApi<FastaDatasetRow>, node: IRowNode<FastaDatasetRow> | null): PlId[] {
  // @todo remove casting when AG-12581 will be resolved:
  // https://www.ag-grid.com/pipeline/
  // https://github.com/ag-grid/ag-grid/issues/8538
  const samples = api.getSelectedRows().map(row => (row as FastaDatasetRow).sample).filter(isPlId);
  if (samples.length !== 0)
    return samples;
  const sample = node?.data?.sample;
  if (!sample)
    return [];
  return [sample];
}

const gridOptions: GridOptions<FastaDatasetRow> = {
  getRowId: (row) => row.data.sample ?? 'new',
  rowSelection: 'multiple',
  getMainMenuItems: (params) => {
    return [];
  },
  getContextMenuItems: (params) => {
    if (getSelectedSamples(params.api, params.node).length === 0)
      return [];
    return [{
      name: "Delete",
      action: (params) => {
        const samplesToDelete = getSelectedSamples(params.api, params.node);
        dataset.update(ds => { for (const s of samplesToDelete) delete ds.content.data[s] })
      }
    }];
  },
  components: {
    FileCell
  }
};
</script>

<template>
  <!-- :style="{ height: '600px' }" -->
  <div class="ag-theme-quartz" :style="{ height: '100%' }">
    <ag-grid-vue :style="{ height: '100%' }" :rowData="rowData" :columnDefs="columnDefs" :gridOptions="gridOptions">
    </ag-grid-vue>
  </div>
</template>
