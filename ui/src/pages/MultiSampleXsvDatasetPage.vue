<script setup lang="ts">
import type { ColDef, GridOptions } from "ag-grid-enterprise";
import {
  ClientSideRowModelModule,
  MenuModule,
  ModuleRegistry,
  RichSelectModule,
} from "ag-grid-enterprise";

import { AgGridVue } from "ag-grid-vue3";

import type { DSMultiSampleXsv, PlId } from "@platforma-open/milaboratories.samples-and-data.model";
import type { ImportFileHandle } from "@platforma-sdk/model";
import {
  AgGridTheme,
  makeRowNumberColDef,
  PlAgCellFile,
  PlAgColumnHeader,
} from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "../app";
import SyncDatasetDialog from "../dialogs/SyncDatasetDialog.vue";
import { agGroupIdColumnDef } from "../util";

// AG Grid features the table uses
ModuleRegistry.registerModules([ClientSideRowModelModule, RichSelectModule, MenuModule]);

const app = useApp();

// The dataset shown on this page, from the route's `id`
const datasetId = app.queryParams.id;

const dataset = computed(() => {
  const ds = app.model.data.datasets.find((ds) => ds.id === datasetId);
  if (!ds) throw new Error("Dataset not found");
  return ds as DSMultiSampleXsv;
});

// One table row per file (group)
type DatasetRow = {
  readonly groupId: PlId;
  readonly groupLabel: string;
  // number of samples in the group
  readonly nSamples: number | undefined;
  readonly data?: ImportFileHandle | null;
};

// Distinct sample values per file, found by the prerun
const parsedSampleGroups = computed(() => {
  // For MultiSampleXsv, data is already deserialized as Record<PlId, PlId[]>
  return app.model.outputs.sampleGroups?.[dataset.value.id] as Record<PlId, PlId[]> | undefined;
});

// Table rows: each file with its label and how many samples it holds
const rowData = computed(() => {
  const groupToSample = parsedSampleGroups.value;
  return Object.entries(dataset.value.content.data).flatMap(([groupId, data]) => ({
    groupId: groupId as PlId,
    groupLabel: dataset.value.content.groupLabels[groupId as PlId],
    nSamples: groupToSample?.[groupId as PlId]?.length,
    data,
  }));
});

// No header menu on any column
const defaultColDef: ColDef = {
  suppressHeaderMenuButton: true,
};

// Columns: row number, sample count, file (group) name, and the file itself
const columnDefs = computed((): ColDef<DatasetRow>[] => {
  return [
    makeRowNumberColDef(),
    {
      headerName: "Samples",
      flex: 1,
      valueGetter: (params) => params.data?.nSamples,
      editable: false,
      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: "Number" },
    },
    agGroupIdColumnDef(),
    {
      headerName: "Data",
      flex: 2,
      cellStyle: { padding: 0 },
      spanRows: true,

      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: "File" },

      // Upload progress of the file in the cell
      cellRendererParams: {
        resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
          const progresses = app.progresses;
          if (!fileHandle) return undefined;
          else return progresses[fileHandle];
        },
      },

      // File cell; a replacement file must have the dataset's extension
      cellRendererSelector: (_) => ({
        component: "PlAgCellFile",
        params: {
          extensions: [
            dataset.value.content.xsvType + (dataset.value.content.gzipped ? ".gz" : ""),
          ],
        },
      }),
      // Reads the group's file; picking a new one replaces it in the dataset
      valueGetter: (params) =>
        params.data?.groupId ? dataset.value.content.data[params.data.groupId] : undefined,
      valueSetter: (params) => {
        const group = params.data.groupId;
        const content = dataset.value.content;
        const file = params.newValue ?? null;
        if (content.data[group] === file) return false;
        content.data[group] = file;
        // The new file's samples are unknown until "Import samples": drop the old mapping so Run waits for it
        if (content.sampleGroups?.[group] !== undefined) {
          const { [group]: _replaced, ...kept } = content.sampleGroups;
          content.sampleGroups = kept;
        }
        return true;
      },
    },
  ];
});

// Rows keyed by group id; multi-row selection without checkboxes; file cells may span rows
const gridOptions: GridOptions<DatasetRow> = {
  getRowId: (row) => row.data.groupId,
  rowSelection: {
    mode: "multiRow",
    checkboxes: false,
    headerCheckbox: false,
  },
  rowHeight: 45,
  getMainMenuItems: () => {
    return [];
  },
  components: {
    PlAgCellFile,
  },
  enableCellSpan: true,
};
</script>

<template>
  <!-- "Import samples" banner for this dataset -->
  <SyncDatasetDialog :dataset-ids="[datasetId as PlId]" />

  <!-- One row per file -->
  <AgGridVue
    :theme="AgGridTheme"
    :style="{ height: '100%' }"
    :rowData="rowData"
    :defaultColDef="defaultColDef"
    :columnDefs="columnDefs"
    :gridOptions="gridOptions"
  />
</template>
