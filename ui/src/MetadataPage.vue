<script setup lang="ts">
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';

import {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
  ModuleRegistry
} from '@ag-grid-community/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';

import { AgGridVue } from '@ag-grid-community/vue3';

import {
  Dataset,
  MetadataColumnValueType,
  PlId,
  uniquePlId
} from '@milaboratory/milaboratories.samples-and-data.model';
import { PlBtnSecondary } from '@milaboratory/platforma-uikit';
import { useApp } from './app';
import { computed, ref, shallowRef } from 'vue';
import { notEmpty, undef } from '@milaboratory/helpers';

const app = useApp();

app.createArgsModel();

ModuleRegistry.registerModules([ClientSideRowModelModule]);

async function handleAddDatasetFasta() {
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

const gridApi = shallowRef<GridApi<any>>();
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
  rowMultiSelectWithClick: true,
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
  }
};
</script>

<template>
  <div class="container">
    <div class="d-flex gap-4">
      <pl-btn-secondary @click="handleAddDatasetFasta">Add Dataset</pl-btn-secondary>
      <pl-btn-secondary @click="addRow">Add Sample</pl-btn-secondary>
      <pl-btn-secondary @click="() => addColumn('String')">Add String Column</pl-btn-secondary>
      <pl-btn-secondary @click="() => addColumn('Double')">Add Numeric Column</pl-btn-secondary>
      <pl-btn-secondary @click="() => addColumn('Long')">Add Integer Column</pl-btn-secondary>
      <pl-btn-secondary v-if="toRemoveIdx >= 0" @click="() => deleteMetaColumn(toRemoveIdx)">Delete {{
        app.args.metadata[toRemoveIdx].label }}</pl-btn-secondary>
    </div>
    <div class="ag-theme-quartz" :style="{ height: '300px' }">
      <ag-grid-vue :style="{ height: '100%' }" @grid-ready="onGridReady" :rowData="rowData" :columnDefs="columnDefs"
        :grid-options="gridOptions">
      </ag-grid-vue>
    </div>
    <!-- <add-graph
      @selected="(v) => onSelect(v as GraphMakerSettings['chartType'])"
      :items="CHART_TYPES"
    /> -->
  </div>
</template>

<style lang="css">
button {
  padding: 12px 0;
}

.container {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  gap: 24px;
}
</style>

<!-- <script setup lang="ts">

// const app = useApp();

// const data = reactive({
//   modalOpen: false,
//   storageHandle: undefined as StorageHandle | undefined,
//   lsPath: '/Users/gramkin/Code' as string | undefined,
//   storageList: [] as StorageEntry[],
//   files: [] as LsEntry[],
//   lsError: undefined as unknown
// });

// const fileHandle = createModel({
//   get() {
//     return app.args.fileHandle;
//   },
//   validate: z.string().optional().parse,
//   autoSave: true,
//   onSave(v) {
//     console.log('save v', v);
//     app.updateArgs(args => args.fileHandle = v);
//   }
// });

// const fileOptions = computed(() => data.files.filter(it => it.type === 'file').map(it => ({
//   text: it.fullPath,
//   value: it.handle
// })));

// const file = computed(() => app.getOutputFieldOkOptional('file'));

// const progress = computed(() => app.getOutputFieldOkOptional('progress'));

// const loadFiles = debounce((handle: StorageHandle, lsPath: string) => {
//   platforma.lsDriver.listFiles(handle, lsPath).then(result => {
//     data.files = result.entries;
//   }).catch(err => {
//     console.log('error', err);
//     data.lsError = err;
//   });
// }, 1000);

// watch(() => [data.storageHandle, data.lsPath] as const, ([s, p]) => {
//   data.files = [];
//   data.lsError = undefined;
//   if (s && p) {
//     console.log('call load', s, p);
//     loadFiles(s, p)
//   }
// });

// const onImport = (v: ImportedFiles) => {
//   if (v.files.length) {
//     fileHandle.modelValue = v.files[0];
//   }
// };

// onMounted(() => {
//   platforma.lsDriver.getStorageList().then(lst => {
//     data.storageList = lst ?? [];
//   });
// });
</script>

<template>
  <div class="container">
    <h3>Import file</h3>

    <select-input label="Storage" v-model="data.storageHandle"
      :options="data.storageList.map(it => ({ text: it.name, value: it.handle }))" />

    <text-field v-if="data.storageHandle" label="LS Path" v-model="data.lsPath" />

    <select-input label="File to upload" v-model="fileHandle.modelValue" :options="fileOptions" clearable />

    <fieldset>
      <legend>File content</legend>
      <pre>{{ file }}</pre>
    </fieldset>

    <fieldset>
      <legend>Progress</legend>
      {{ progress }}
    </fieldset>

    <btn-primary @click="data.modalOpen = true">Or open file dialog</btn-primary>

    <div v-if="data.lsError" class="alert-error">
      Error: {{ data.lsError }}
    </div>
    <fieldset v-else>
      <legend>{{ data.lsPath }}</legend>
      <pre style="overflow: auto; max-height: 300px; max-width: 100%;">{{ data.files }}</pre>
    </fieldset>

    <file-dialog v-model="data.modalOpen" @import:files="onImport" />
</div>
</template>

<style lang="css">
.alert-error {
  background-color: red;
  color: #fff;
  padding: 12px;
}

.container {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  gap: 24px;
}

fieldset {
  max-height: 300px;
  max-width: 100%;
  overflow: auto;
}

fieldset pre {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  max-width: 600px;
}
</style> -->
