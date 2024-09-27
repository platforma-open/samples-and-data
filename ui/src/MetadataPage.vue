<script setup lang="ts">
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';

import {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IRowNode,
  ModuleRegistry
} from '@ag-grid-community/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';

import { AgGridVue } from '@ag-grid-community/vue3';

import {
  Dataset,
  MetadataColumnValueType,
  PlId,
  uniquePlId
} from '@platforma-open/milaboratories.samples-and-data.model';
import { PlBlockPage, PlBtnSecondary } from '@milaboratories/uikit';
import { useApp } from './app';
import { computed, ref, shallowRef } from 'vue';
import { notEmpty, undef } from '@milaboratories/helpers';
import { MenuModule } from '@ag-grid-enterprise/menu';

const app = useApp();

ModuleRegistry.registerModules([ClientSideRowModelModule, MenuModule]);

async function addDatasetFasta() {
  const id = uniquePlId();
  await app.updateArgs((arg) => {
    arg.datasets.push({
      id: id,
      label: 'The Dataset',
      content: {
        type: 'Fastq',
        gzipped: true,
        readIndices: ['R1', 'R2'],
        data: {}
      }
    });
  });
  await app.navigateTo(`/dataset?id=${id}`);
}

const gridApi = shallowRef<GridApi<MetadataRow>>();
const onGridReady = (params: GridReadyEvent) => {
  gridApi.value = params.api;
};

async function addRow() {
  const sampleId = uniquePlId();
  await app.updateArgs((arg) => {
    arg.sampleIds.push(sampleId);
    arg.sampleLabels[sampleId] = `New Sample (${Object.values(arg.sampleLabels).length})`;
  });
}

async function addColumn(valueType: MetadataColumnValueType) {
  const metaColumnId = uniquePlId();
  await app.updateArgs((arg) => {
    arg.metadata.push({
      id: metaColumnId,
      valueType,
      label: `Meta Column (${Object.values(arg.metadata).length})`,
      global: true,
      data: {}
    });
  });
}

const toRemoveIdx = ref<number>(-1);

async function deleteMetaColumn(metaColumnIdx: number) {
  toRemoveIdx.value = -1;
  await app.updateArgs((arg) => {
    arg.metadata.splice(metaColumnIdx, 1);
  });
}

type MetadataRow = {
  id: PlId;
  label: string;
  meta: Record<PlId, string | number | undefined>;
};

function getSelectedSamples(node: IRowNode<MetadataRow> | null): PlId[] {
  // @todo remove casting when AG-12581 will be resolved:
  // https://www.ag-grid.com/pipeline/
  // https://github.com/ag-grid/ag-grid/issues/8538
  const samples = gridApi.value!.getSelectedRows().map(row => (row as MetadataRow).id);
  if (samples.length !== 0)
    return samples;
  const sample = node?.data?.id;
  if (!sample)
    return [];
  return [sample];
}

async function deleteSamples(sampleIds: PlId[]) {
  await app.updateArgs((arg) => {
    arg.sampleIds = arg.sampleIds.filter(s => !sampleIds.includes(s))
    for (const s of sampleIds) {
      delete arg.sampleLabels[s];
      for (const m of arg.metadata)
        delete m.data[s];
      for (const ds of arg.datasets)
        delete ds.content.data[s];
    }
  });
}

const columnDefs = computed<ColDef[]>(() => [
  {
    colId: 'label',
    field: 'label',
    editable: true,
    headerName: app.args.sampleLabelColumnLabel
  },
  ...app.args.metadata.map((mCol): ColDef => {
    const common: ColDef = {
      colId: `meta.${mCol.id}`,
      field: `meta.${mCol.id}`,
      headerName: mCol.label,
      editable: true
    };
    switch (mCol.valueType) {
      case 'String':
        return common;
      case 'Double':
        return {
          ...common,
          cellDataType: 'number',
          cellEditor: 'agNumberCellEditor'
        };
      case 'Long':
        return {
          ...common,
          cellDataType: 'number',
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: {
            precision: 0,
            showStepperButtons: true
          }
        };
    }
  })
]);

const rowData = computed<MetadataRow[]>(() =>
  app.args.sampleIds.map((id) => ({
    id,
    label: app.args.sampleLabels[id]!,
    meta: Object.fromEntries(app.args.metadata.map((mCol) => [mCol.id, mCol.data[id]]))
  }))
);

const gridOptions: GridOptions<MetadataRow> = {
  getRowId: (row) => row.data.id,

  rowSelection: 'multiple',

  onColumnHeaderClicked: (event) => {
    const columnId = event.column.getId();
    if (columnId.startsWith('meta.')) {
      const metaColumnId = columnId.slice(5);
      toRemoveIdx.value = app.args.metadata.findIndex((mCol) => mCol.id === metaColumnId);
    } else toRemoveIdx.value = -1;
  },
  onCellValueChanged: (event) => {
    const columnId = event.column.getId();
    const sampleId = event.data.id;
    const newValue = event.newValue;
    if (columnId === 'label') {
      app.updateArgs((arg) => {
        if (newValue) arg.sampleLabels[sampleId] = newValue;
        else delete arg.sampleLabels[sampleId];
      });
    } else if (columnId.startsWith('meta.')) {
      const metaColumnId = columnId.slice(5);
      app.updateArgs((arg) => {
        const metaColumn = notEmpty(arg.metadata.find((col) => col.id === metaColumnId));
        if (newValue) metaColumn.data[sampleId] = newValue;
        else delete metaColumn.data[sampleId];
      });
    } else throw new Error('Unexpected Column Id');
  },

  getMainMenuItems: (params) => {
    return [];
  },
  getContextMenuItems: (params) => {
    const targetSamples = getSelectedSamples(params.node);
    if (getSelectedSamples(params.node).length === 0)
      return [];
    return [{
      name: `Delete ${targetSamples.length > 1 ? `${targetSamples.length} samples` : app.args.sampleLabels[targetSamples[0]]}`,
      action: (params) => {
        const samplesToDelete = getSelectedSamples(params.node);
        deleteSamples(targetSamples);
      }
    }];
  },
};
</script>

<template>
  <PlBlockPage>
    <template #title>Samples & Metadata</template>
    <div class="d-flex gap-4">
      <PlBtnSecondary @click="addDatasetFasta">Add Dataset</PlBtnSecondary>
      <PlBtnSecondary @click="addRow">Add Sample</PlBtnSecondary>
      <PlBtnSecondary @click="() => addColumn('String')">Add String Column</PlBtnSecondary>
      <PlBtnSecondary @click="() => addColumn('Double')">Add Numeric Column</PlBtnSecondary>
      <PlBtnSecondary @click="() => addColumn('Long')">Add Integer Column</PlBtnSecondary>
    </div>
    <div class="ag-theme-quartz" :style="{ flex: 1 }">
      <AgGridVue :style="{ height: '100%' }" @grid-ready="onGridReady" :rowData="rowData" :columnDefs="columnDefs"
        :grid-options="gridOptions" />
    </div>
  </PlBlockPage>
</template>
