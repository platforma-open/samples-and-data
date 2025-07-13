<script setup lang="ts">
import {
  ClientSideRowModelModule,
  type ColDef,
  type GridApi,
  type GridOptions,
  type GridReadyEvent,
  type IRowNode,
  MenuModule,
  ModuleRegistry,
} from 'ag-grid-enterprise';
import { AgGridVue } from 'ag-grid-vue3';

import { notEmpty } from '@milaboratories/helpers';
import type {
  MetadataColumnValueType,
} from '@platforma-open/milaboratories.samples-and-data.model';
import type { PlId } from '@platforma-sdk/model';
import { uniquePlId } from '@platforma-sdk/model';
import {
  AgGridTheme,
  PlAgColumnHeader,
  type PlAgHeaderComponentParams,
  PlAgOverlayNoRows,
  PlBlockPage,
  PlBtnGhost,
  PlBtnPrimary,
  PlDialogModal,
  PlEditableTitle
} from '@platforma-sdk/ui-vue';
import { computed, reactive, shallowRef, useCssModule } from 'vue';
import { useApp } from '../app';
import type { ImportResult } from '../dataimport';
import { readFileForImport } from '../dataimport';

import DatasetCell from './components/DatasetCell.vue';
import ImportDatasetDialog from './modals/ImportDatasetDialog.vue';
import ImportMetadataModal from './modals/ImportMetadataModal.vue';

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
  errorMessage: undefined,
});

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
      data: {},
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
    filters: [{ extensions: ['xlsx', 'csv', 'tsv', 'txt'], name: 'Table data' }],
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
  } catch (e) {
    console.log(e);
    data.errorMessage = { title: 'Error reading table', message: (e as Error).message };
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

const columnDefs = computed<ColDef[]>(() => {
  const colDefs: ColDef[] = [
    // { ...makeRowNumberColDef(), suppressHeaderMenuButton: true },
    {
      colId: 'label',
      field: 'label',
      editable: true,
      headerName: app.model.args.sampleLabelColumnLabel,
      minWidth: 100,
      maxWidth: 300,
      suppressHeaderMenuButton: true,
      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
    },
    {
      colId: 'datasets',
      field: 'datasets',
      editable: false,
      headerName: 'Data',
      cellRendererSelector: (params) => ({
        component: 'DatasetCell',
        params: {
          datasets: params.data.datasets,
        },
      }),
      minWidth: 100,
      suppressHeaderMenuButton: true,
      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
    },
    ...app.model.args.metadata.map((mCol): ColDef => {
      const common: ColDef = {
        colId: `meta.${mCol.id}`,
        field: `meta.${mCol.id}`,
        headerName: mCol.label,
        editable: true,
        minWidth: 100,
        maxWidth: 200,
      };
      switch (mCol.valueType) {
        case 'String':
          return {
            ...common,
            headerComponent: PlAgColumnHeader,
            headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
          };
        case 'Double':
          return {
            ...common,
            cellDataType: 'number',
            cellEditor: 'agNumberCellEditor',
            headerComponent: PlAgColumnHeader,
            headerComponentParams: { type: 'Number' } satisfies PlAgHeaderComponentParams,
          };
        case 'Long':
          return {
            ...common,
            cellDataType: 'number',
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: {
              precision: 0,
              showStepperButtons: true,
            },
            headerComponent: PlAgColumnHeader,
            headerComponentParams: { type: 'Number' } satisfies PlAgHeaderComponentParams,
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
      lockPinned: true,
    },
  ];

  return colDefs.map((c, i, arr) => arr.length === i + 2 /** before last "+" column */ ? { ...c, flex: 1, minWidth: 200, maxWidth: undefined } : c);
});

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
    datasets: samples2ds[id],
  }));
});

const gridOptions = computed<GridOptions<MetadataRow>>(() => ({
  getRowId: (row) => row.data.id,

  rowSelection: {
    mode: 'multiRow',
    checkboxes: false,
    headerCheckbox: false,
  },

  autoSizeStrategy: {
    type: 'fitCellContents',
    colIds: columnDefs.value.slice(0, -2).map((c) => c.colId!), // except last two columns
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
          action: () => addColumn('String'),
        },
        {
          name: 'Add Integer Column',
          action: () => addColumn('Long'),
        },
        {
          name: 'Add Numerical Column',
          action: () => addColumn('Double'),
        },
      ];
    } else if (columnId.startsWith('meta.')) {
      const metaColumnId = columnId.slice(5);
      return [
        {
          name: `Delete ${params?.column?.getColDef().headerName}`,
          action: () => deleteMetaColumn(metaColumnId),
        },
      ];
    } else return [];
  },

  getContextMenuItems: (params) => {
    console.log('Ctx:', params);
    const targetSamples = getSelectedSamples(params.node);
    if (getSelectedSamples(params.node).length === 0) return [];
    return [
      {
        name: `Delete ${
          targetSamples.length > 1
            ? `${targetSamples.length} samples`
            : app.model.args.sampleLabels[targetSamples[0]]
        }`,
        action: () => {
          deleteSamples(targetSamples);
        },
      },
    ];
  },

  components: {
    DatasetCell,
  },
}));
</script>

<template>
  <PlBlockPage>
    <template #title>
      <PlEditableTitle
        v-model="app.model.args.blockTitle"
        :max-length="40"
        max-width="600px"
        placeholder="Samples & Data"
      />
    </template>
    <template #append>
      <PlBtnGhost icon="dna-import" @click.stop="() => (app.showImportDataset = true)">
        Import sequencing data
      </PlBtnGhost>
      &nbsp;
      <PlBtnGhost icon="table-import" @click.stop="importMetadata"> Import metadata </PlBtnGhost>
    </template>
    <div :style="{ flex: 1 }">
      <AgGridVue
        :theme="AgGridTheme"
        :style="{ height: '100%' }"
        :rowData="rowData"
        :columnDefs="columnDefs"
        :grid-options="gridOptions"
        :noRowsOverlayComponent="PlAgOverlayNoRows"
        @grid-ready="onGridReady"
      />
    </div>
  </PlBlockPage>

  <ImportDatasetDialog v-if="app.showImportDataset" />

  <ImportMetadataModal
    v-if="data.importCandidate !== undefined"
    :import-candidate="data.importCandidate"
    @on-close="data.importCandidate = undefined"
  />

  <PlDialogModal
    :model-value="data.errorMessage !== undefined"
    closable
    @update:model-value="
      (v) => {
        if (!v) data.errorMessage = undefined;
      }
    "
  >
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
