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
  MetadataColumnValueType,
  PlId,
  uniquePlId
} from '@platforma-open/milaboratories.samples-and-data.model';
import { PlBlockPage, PlBtnGhost, PlBtnPrimary, PlBtnSecondary, PlDialogModal } from '@platforma-sdk/ui-vue';
import { useApp } from './app';
import { computed, inject, reactive, shallowRef } from 'vue';
import { notEmpty } from '@milaboratories/helpers';
import { MenuModule } from '@ag-grid-enterprise/menu';
import { useCssModule } from 'vue'
import { ImportResult, readFileForImport } from './dataimport';
import ImportModal from './ImportModal.vue';

const styles = useCssModule()

const app = useApp();

type ErrorMessage = {
  title: string,
  message?: string
}

const data = reactive<{
  importCandidate: ImportResult | undefined,
  errorMessage: ErrorMessage | undefined
}>({
  importCandidate: undefined,
  errorMessage: undefined
})

if (app.model.args.datasets.length === 0 && !app.model.ui?.suggestedImport) {
  if (app.model.ui === undefined)
    app.model.ui = { suggestedImport: true }
  else
    app.model.ui.suggestedImport = true;
  app.navigateTo('/import-files');
}

ModuleRegistry.registerModules([ClientSideRowModelModule, MenuModule]);

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

async function deleteMetaColumn(metaColumnId: string) {
  const metaColumnIdx = app.args.metadata.findIndex((mCol) => mCol.id === metaColumnId)
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
  const samples = gridApi.value!.getSelectedRows().map(row => row.id);
  if (samples.length !== 0)
    return samples;
  const sample = node?.data?.id;
  if (!sample)
    return [];
  return [sample];
}

async function importMetadata() {
  const result = await platforma!.lsDriver.showOpenSingleFileDialog({
    title: "Import metadata table",
    buttonLabel: "Import",
    filters: [{ extensions: ["*"], name: "Any file" }, { extensions: ["csv"], name: "CSV File" }]
  })
  const file = result.file;
  if (!file)
    return;
  if (await platforma!.lsDriver.getLocalFileSize(file) > 5_000_000) {
    data.errorMessage = { title: "File is too big" };
    return;
  }
  const content = await platforma!.lsDriver.getLocalFileContent(file);
  try {
    const ic = readFileForImport(content);
    if (ic.data.columns.length === 0 || ic.data.rows.length === 0) {
      // TODO human readable parsing metrics
      data.errorMessage = { title: "Table is empty", message: JSON.stringify(ic) };
      return;
    }
    console.dir(ic, { depth: 5 });
    data.importCandidate = ic;
  } catch (e: any) {
    console.log(e);
    data.errorMessage = { title: "Error reading table", message: e.msg };
  }
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
    headerName: app.args.sampleLabelColumnLabel,
    flex: 1
  },
  ...app.args.metadata.map((mCol): ColDef => {
    const common: ColDef = {
      colId: `meta.${mCol.id}`,
      field: `meta.${mCol.id}`,
      headerName: mCol.label,
      editable: true,
      flex: 1
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
  }),
  {
    colId: 'add',
    headerName: '+',
    headerClass: styles.plusHeader,
    suppressHeaderMenuButton: true,
    minWidth: 45,
    maxWidth: 45,
    sortable: false,
    resizable: false
  },
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

  autoSizeStrategy: {
    type: 'fitGridWidth'
  },
  stopEditingWhenCellsLoseFocus: true,

  onColumnHeaderClicked: (event) => {
    const columnId = event.column.getId();
    if (columnId === 'add') {
      event.api.showColumnMenu('add');
    }
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
    const columnId = params.column.getId();
    if (columnId === 'add') {
      return [{
        name: 'Add String Column',
        action: (params) => addColumn('String')
      }, {
        name: 'Add Integer Column',
        action: (params) => addColumn('Long')
      }, {
        name: 'Add Numerical Column',
        action: (params) => addColumn('Double')
      }];
    } else if (columnId.startsWith('meta.')) {
      const metaColumnId = columnId.slice(5);
      return [{
        name: `Delete ${params.column.getColDef().headerName}`,
        action: (params) => deleteMetaColumn(metaColumnId)
      }];
    } else
      return [];
  },

  getContextMenuItems: (params) => {
    console.log("Ctx:", params);
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
    <template #append>
      <PlBtnGhost :icon="'import'" @click.stop="importMetadata">Import meta table</PlBtnGhost>
    </template>
    <div class="ag-theme-quartz" :style="{ flex: 1 }">
      <AgGridVue :style="{ height: '100%' }" @grid-ready="onGridReady" :rowData="rowData" :columnDefs="columnDefs"
        :grid-options="gridOptions" />
    </div>
  </PlBlockPage>
  <ImportModal v-if="data.importCandidate !== undefined" :import-candidate="data.importCandidate"
    @on-close="data.importCandidate = undefined" />
  <PlDialogModal :model-value="data.errorMessage !== undefined" closable
    @update:model-value="(v) => { if (!v) data.errorMessage = undefined }">
    <div>{{ data.errorMessage?.title }}</div>
    <pre v-if="data.errorMessage?.message">{{ data.errorMessage?.message }}</pre>
    <PlBtnPrimary>Ok</PlBtnPrimary>
  </PlDialogModal>
</template>

<style lang="css" module>
.plusHeader {
  padding-left: 0;
  padding-right: 0;
  text-align: center;
}

.plusHeader :global(.ag-header-cell-label) {
  justify-content: center;
}

.plusHeader :global(.ag-sort-indicator-container) {
  display: none;
}
</style>