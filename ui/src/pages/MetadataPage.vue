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
  WithSampleGroupsData,
} from '@platforma-open/milaboratories.samples-and-data.model';
import {
  isGroupedDataset,
  type MTValueType,
  type PlId,
} from '@platforma-open/milaboratories.samples-and-data.model';
import { uniquePlId } from '@platforma-sdk/model';
import {
  AgGridTheme,
  makeRowNumberColDef,
  PlAgColumnHeader,
  type PlAgHeaderComponentParams,
  PlAgOverlayNoRows,
  PlBlockPage,
  PlBtnGhost,
  PlBtnPrimary,
  PlDialogModal,
  PlEditableTitle,
  PlTextField,
} from '@platforma-sdk/ui-vue';
import { computed, reactive, shallowRef, useCssModule } from 'vue';
import { useApp } from '../app';
import DatasetCell from '../components/DatasetCell.vue';
import ImportErrorDialog from '../components/ImportErrorDialog.vue';
import { useTableImport } from '../composables/useTableImport';
import ImportDatasetDialog from '../dialogs/ImportDatasetDialog.vue';
import ImportMetadataModal from '../dialogs/ImportMetadataDialog.vue';
import SyncDatasetDialog from '../dialogs/SyncDatasetDialog.vue';

const styles = useCssModule();

const app = useApp();

const groupedDatasets = computed(() => app.model.args.datasets.filter(isGroupedDataset));

// Datasets that should have automatic sample extraction (excludes MultiplexedFastq)
const datasetsWithAutoExtraction = computed(() =>
  groupedDatasets.value.filter((ds) => ds.content.type !== 'MultiplexedFastq'),
);

const { state: importState, importTable, clearImportCandidate, clearErrorMessage } = useTableImport();

const data = reactive<{
  showAddColumnDialog: boolean;
  newColumnName: string;
  newColumnType?: MTValueType;
}>({
  showAddColumnDialog: false,
  newColumnName: '',
});

ModuleRegistry.registerModules([ClientSideRowModelModule, MenuModule]);

const gridApi = shallowRef<GridApi<MetadataRow>>();
const onGridReady = (params: GridReadyEvent) => {
  gridApi.value = params.api;
};

function showAddColumnDialog(type: MTValueType) {
  data.showAddColumnDialog = true;
  data.newColumnName = `Metadata Column ${Object.values(app.model.args.metadata).length + 1}`;
  data.newColumnType = type;
}

function closeAddColumnDialog() {
  data.showAddColumnDialog = false;
  data.newColumnName = '';
  data.newColumnType = undefined;
}

async function addColumn(valueType: MTValueType, name: string) {
  const metaColumnId = uniquePlId();

  app.model.args.metadata.push({
    id: metaColumnId,
    valueType,
    label: name,
    global: true,
    data: {},
  });

  await app.allSettled();
}

async function deleteMetaColumn(metaColumnId: string) {
  const metaColumnIdx = app.model.args.metadata.findIndex((mCol) => mCol.id === metaColumnId);
  app.model.args.metadata.splice(metaColumnIdx, 1);
  await app.allSettled();
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
  await importTable({
    title: 'Import metadata table',
    buttonLabel: 'Import',
    fileExtensions: ['xlsx', 'csv', 'tsv', 'txt'],
  });
}

async function deleteSamples(sampleIds: PlId[]) {
  app.model.args.sampleIds = app.model.args.sampleIds.filter((s) => !sampleIds.includes(s));

  // delete from non-grouped datasets
  for (const s of sampleIds) {
    delete app.model.args.sampleLabels[s];
    for (const m of app.model.args.metadata) delete m.data[s];

    for (const ds of app.model.args.datasets) {
      if (!isGroupedDataset(ds)) {
        delete ds.content.data[s];
      }
    }
  }

  // delete from grouped datasets
  for (const ds of app.model.args.datasets) {
    if (isGroupedDataset(ds)) {
      const content = ds.content as WithSampleGroupsData<unknown>;
      for (const groupId of Object.keys(content.sampleGroups ?? {})) {
        const samples = content.sampleGroups?.[groupId as PlId];
        if (samples) {
          for (const sId of sampleIds) {
            delete samples[sId as PlId];
          }
        }
      }
    }
  }
  await app.allSettled();
}

const columnDefs = computed<ColDef[]>(() => {
  const colDefs: ColDef[] = [
    { ...makeRowNumberColDef(), suppressHeaderMenuButton: true },
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
    if (isGroupedDataset(ds)) {
      const content = ds.content as WithSampleGroupsData<unknown>;
      for (const [_, samples] of Object.entries(content.sampleGroups ?? {})) {
        for (const sId of Object.keys(samples)) {
          if (samples2ds[sId] === undefined) {
            samples2ds[sId] = [];
          }
          samples2ds[sId].push(ds.label);
        }
      }
    } else {
      for (const sId of Object.keys(ds.content.data)) {
        if (samples2ds[sId] === undefined) {
          samples2ds[sId] = [];
        }
        samples2ds[sId].push(ds.label);
      }
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

  onCellValueChanged: async (event) => {
    const columnId = event.column.getId();
    const sampleId = event.data.id;
    const newValue = event.newValue;
    if (columnId === 'label') {
      if (newValue)
        app.model.args.sampleLabels[sampleId] = newValue;
      else
        delete app.model.args.sampleLabels[sampleId];
    } else if (columnId.startsWith('meta.')) {
      const metaColumnId = columnId.slice(5);
      const metaColumn = notEmpty(app.model.args.metadata.find((col) => col.id === metaColumnId));
      if (newValue)
        metaColumn.data[sampleId] = newValue;
      else
        delete metaColumn.data[sampleId];
    } else
      throw new Error('Unexpected Column Id');
    await app.allSettled();
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
          action: (_) => showAddColumnDialog('String'),
        },
        {
          name: 'Add Integer Column',
          action: (_) => showAddColumnDialog('Long'),
        },
        {
          name: 'Add Numerical Column',
          action: (_) => showAddColumnDialog('Double'),
        },
      ];
    } else if (columnId.startsWith('meta.')) {
      const metaColumnId = columnId.slice(5);
      return [
        {
          name: `Delete ${params?.column?.getColDef().headerName}`,
          action: (_) => deleteMetaColumn(metaColumnId),
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
        action: (_) => {
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
        Import Dataset
      </PlBtnGhost>
      &nbsp;
      <PlBtnGhost icon="table-import" @click.stop="importMetadata"> Import metadata </PlBtnGhost>
    </template>

    <SyncDatasetDialog :dataset-ids="datasetsWithAutoExtraction.map((ds) => ds.id)" />

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
    v-if="importState.importCandidate !== undefined"
    :import-candidate="importState.importCandidate"
    @on-close="clearImportCandidate"
  />

  <PlDialogModal
    :model-value="data.showAddColumnDialog"
    closable
    @update:model-value="closeAddColumnDialog"
  >
    <template #title>Add Column</template>

    <PlTextField
      v-model="data.newColumnName"
      label="Specify Column Name"
      placeholder="Column Name"
    />

    <template #actions>
      <PlBtnPrimary
        :disabled="data.newColumnName.length === 0 || !data.newColumnType"
        @click="addColumn(data.newColumnType!, data.newColumnName); closeAddColumnDialog()"
      >
        Create
      </PlBtnPrimary>

      <PlBtnGhost
        @click.stop="closeAddColumnDialog"
      >
        Cancel
      </PlBtnGhost>
    </template>
  </PlDialogModal>

  <ImportErrorDialog
    :error-message="importState.errorMessage"
    @close="clearErrorMessage"
  />
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
