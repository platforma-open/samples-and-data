<script setup lang="ts">
import {
  ClientSideRowModelModule,
  type ColDef,
  type GridApi,
  type GridOptions,
  type GridReadyEvent,
  type IRowNode,
  MenuModule,
  ModuleRegistry
} from 'ag-grid-enterprise';
import { AgGridVue } from 'ag-grid-vue3';

import { notEmpty } from '@milaboratories/helpers';
import {
  MetadataColumnValueType,
  PlId,
  uniquePlId
} from '@platforma-open/milaboratories.samples-and-data.model';
import {
  AgGridTheme,
  makeRowNumberColDef,
  PlAgOverlayNoRows,
  PlBlockPage,
  PlBtnGhost,
  PlBtnPrimary,
  PlDialogModal,
  PlEditableTitle,
  PlMaskIcon24
} from '@platforma-sdk/ui-vue';
import { computed, reactive, ref, shallowRef, useCssModule } from 'vue';
import { useApp } from './app';
import { ImportResult, readFileForImport } from './dataimport';
import DatasetCell from './DatasetCell.vue';
import ImportDatasetDialog from './ImportDatasetDialog.vue';
import ImportMetadataModal from './ImportMetadataModal.vue';

const styles = useCssModule();

const app = useApp();

type ErrorMessage = {
  title: string;
  message?: string;
};

const data = reactive<{
  importCandidate: ImportResult | undefined;
  errorMessage: ErrorMessage | undefined;
}>({
  importCandidate: undefined,
  errorMessage: undefined
});

const showImportDataset = ref(false);

if (app.model.args.datasets.length === 0 && !app.model.ui?.suggestedImport) {
  if (app.model.ui === undefined) app.model.ui = { suggestedImport: true };
  else app.model.ui.suggestedImport = true;
  showImportDataset.value = true;
}

ModuleRegistry.registerModules([ClientSideRowModelModule, MenuModule]);

const gridApi = shallowRef<GridApi<MetadataRow>>();
const onGridReady = (params: GridReadyEvent) => {
  gridApi.value = params.api;
};

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
  const metaColumnIdx = app.model.args.metadata.findIndex((mCol) => mCol.id === metaColumnId);
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
  const samples = gridApi.value!.getSelectedRows().map((row) => row.id);
  if (samples.length !== 0) return samples;
  const sample = node?.data?.id;
  if (!sample) return [];
  return [sample];
}

async function importMetadata() {
  const result = await platforma!.lsDriver.showOpenSingleFileDialog({
    title: 'Import metadata table',
    buttonLabel: 'Import',
    filters: [{ extensions: ['xlsx', 'csv', 'tsv', 'txt'], name: 'Table data' }]
  });
  const file = result.file;
  if (!file) return;
  if ((await platforma!.lsDriver.getLocalFileSize(file)) > 5_000_000) {
    data.errorMessage = { title: 'File is too big' };
    return;
  }
  const content = await platforma!.lsDriver.getLocalFileContent(file);
  try {
    const ic = readFileForImport(content);
    if (ic.data.columns.length === 0 || ic.data.rows.length === 0) {
      // TODO human readable parsing metrics
      data.errorMessage = { title: 'Table is empty', message: JSON.stringify(ic) };
      return;
    }
    data.importCandidate = ic;
  } catch (e: any) {
    console.log(e);
    data.errorMessage = { title: 'Error reading table', message: e.msg };
  }
}

async function deleteSamples(sampleIds: PlId[]) {
  await app.updateArgs((arg) => {
    arg.sampleIds = arg.sampleIds.filter((s) => !sampleIds.includes(s));
    for (const s of sampleIds) {
      delete arg.sampleLabels[s];
      for (const m of arg.metadata) delete m.data[s];
      for (const ds of arg.datasets) delete ds.content.data[s];
    }
  });
}

const columnDefs = computed<ColDef[]>(() => [
  { ...makeRowNumberColDef(), suppressHeaderMenuButton: true },
  {
    colId: 'label',
    field: 'label',
    editable: true,
    headerName: app.model.args.sampleLabelColumnLabel,
    initialWidth: 200,
    flex: 1,
    suppressHeaderMenuButton: true
  },
  {
    colId: 'datasets',
    field: 'datasets',
    editable: false,
    headerName: 'Data',
    cellRendererSelector: (params) => ({
      component: 'DatasetCell',
      params: {
        datasets: params.data.datasets
      }
    }),
    // flex: 1,
    suppressHeaderMenuButton: true,
    width: 200
  },
  ...app.model.args.metadata.map((mCol): ColDef => {
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
    resizable: false,
    pinned: 'right',
    lockPinned: true
  }
]);

const rowData = computed<MetadataRow[]>(() => {
  const samples2ds: Record<string, string[]> = {};
  for (const ds of app.model.args.datasets) {
    for (const sId of Object.keys(ds.content.data)) {
      if (samples2ds[sId] === undefined) {
        samples2ds[sId] = [];
      }
      samples2ds[sId].push(ds.label);
    }
  }

  return app.model.args.sampleIds.map((id) => ({
    id,
    label: app.model.args.sampleLabels[id]!,
    meta: Object.fromEntries(app.model.args.metadata.map((mCol) => [mCol.id, mCol.data[id]])),
    datasets: samples2ds[id]
  }));
});

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
    const columnId = params?.column?.getId();
    if (!columnId) {
      return [];
    }
    if (columnId === 'add') {
      return [
        {
          name: 'Add String Column',
          action: (params) => addColumn('String')
        },
        {
          name: 'Add Integer Column',
          action: (params) => addColumn('Long')
        },
        {
          name: 'Add Numerical Column',
          action: (params) => addColumn('Double')
        }
      ];
    } else if (columnId.startsWith('meta.')) {
      const metaColumnId = columnId.slice(5);
      return [
        {
          name: `Delete ${params?.column?.getColDef().headerName}`,
          action: (params) => deleteMetaColumn(metaColumnId)
        }
      ];
    } else return [];
  },

  getContextMenuItems: (params) => {
    console.log('Ctx:', params);
    const targetSamples = getSelectedSamples(params.node);
    if (getSelectedSamples(params.node).length === 0) return [];
    return [
      {
        name: `Delete ${targetSamples.length > 1
          ? `${targetSamples.length} samples`
          : app.model.args.sampleLabels[targetSamples[0]]
          }`,
        action: (params) => {
          const samplesToDelete = getSelectedSamples(params.node);
          deleteSamples(targetSamples);
        }
      }
    ];
  },

  components: {
    DatasetCell
  }
};
</script>

<template>
  <PlBlockPage>
    <template #title>
      <PlEditableTitle max-width="600px" placeholder="Samples & Data" :max-length="40"
        v-model="app.model.args.blockTitle" />
    </template>
    <template #append>
      <PlBtnGhost @click.stop="() => (showImportDataset = true)" icon="dna-import">
        Import sequencing data
      </PlBtnGhost>
      &nbsp;
      <PlBtnGhost @click.stop="importMetadata" icon="table-import">
        Import metadata
      </PlBtnGhost>
    </template>
    <div :style="{ flex: 1 }">
      <AgGridVue :theme="AgGridTheme" :style="{ height: '100%' }" @grid-ready="onGridReady" :rowData="rowData"
        :columnDefs="columnDefs" :grid-options="gridOptions" :noRowsOverlayComponent="PlAgOverlayNoRows" />
    </div>
  </PlBlockPage>

  <ImportDatasetDialog v-if="showImportDataset" @on-close="showImportDataset = false" />

  <ImportMetadataModal v-if="data.importCandidate !== undefined" :import-candidate="data.importCandidate"
    @on-close="data.importCandidate = undefined" />

  <PlDialogModal :model-value="data.errorMessage !== undefined" closable @update:model-value="(v) => {
    if (!v) data.errorMessage = undefined;
  }
    ">
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
