<script setup lang="ts">
import type { BarcodeRule, DSMultiplexedFastq, PlId } from '@platforma-open/milaboratories.samples-and-data.model';
import {
  ClientSideRowModelModule,
  type ColDef,
  type GridApi,
  type GridOptions,
  type GridReadyEvent,
  type IRowNode,
  MenuModule,
  ModuleRegistry,
  RichSelectModule,
} from 'ag-grid-enterprise';
import { AgGridVue } from 'ag-grid-vue3';
import { uniquePlId } from '@platforma-sdk/model';
import {
  AgGridTheme,
  makeRowNumberColDef,
  PlAgColumnHeader,
  type PlAgHeaderComponentParams,
  PlAgOverlayNoRows,
  PlAlert,
  PlBtnGhost,
  PlBtnPrimary,
  PlBtnSecondary,
  PlDialogModal,
  PlTextField,
} from '@platforma-sdk/ui-vue';
import { computed, reactive, shallowRef, useCssModule } from 'vue';
import { useApp } from '../app';

ModuleRegistry.registerModules([ClientSideRowModelModule, RichSelectModule, MenuModule]);

const props = defineProps<{
  dataset: DSMultiplexedFastq;
}>();

const app = useApp();
const styles = useCssModule();

const TAG_NAME_RX = /^[A-Za-z0-9]+$/;

const tags = computed(() => props.dataset.content.barcodeTags);
const rules = computed(() => props.dataset.content.barcodeRules);

const groupIds = computed<string[]>(() => Object.keys(props.dataset.content.data));
const groupIdToLabel = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  for (const groupId of groupIds.value) {
    out[groupId] = props.dataset.content.groupLabels[groupId as PlId] ?? groupId;
  }
  return out;
});

const sampleIds = computed<string[]>(() => Object.keys(app.model.data.sampleLabels));
const sampleIdToLabel = computed<Record<string, string>>(() => ({ ...app.model.data.sampleLabels } as Record<string, string>));

function setTags(next: string[]) {
  props.dataset.content.barcodeTags = next;
}

function setRules(next: BarcodeRule[]) {
  props.dataset.content.barcodeRules = next;
}

// --- Tag dialog (add / rename) ----------------------------------------------

type TagDialogState =
  | { mode: 'closed' }
  | { mode: 'add'; name: string }
  | { mode: 'rename'; oldName: string; name: string };

const tagDialog = reactive<{ state: TagDialogState }>({ state: { mode: 'closed' } });

const tagDialogError = computed<string | undefined>(() => {
  const s = tagDialog.state;
  if (s.mode === 'closed') return undefined;
  const name = s.name.trim();
  if (!name) return 'Tag name is required';
  if (!TAG_NAME_RX.test(name)) return 'Use letters and digits only';
  const collidesWith = tags.value.find((t) =>
    s.mode === 'rename' ? t === name && t !== s.oldName : t === name,
  );
  if (collidesWith) return 'Tag name must be unique';
  return undefined;
});

function openAddTag() {
  let i = tags.value.length + 1;
  let candidate = `Tag${i}`;
  while (tags.value.includes(candidate)) {
    i++;
    candidate = `Tag${i}`;
  }
  tagDialog.state = { mode: 'add', name: candidate };
}

function openRenameTag(oldName: string) {
  tagDialog.state = { mode: 'rename', oldName, name: oldName };
}

function closeTagDialog() {
  tagDialog.state = { mode: 'closed' };
}

function commitTagDialog() {
  const s = tagDialog.state;
  if (s.mode === 'closed') return;
  if (tagDialogError.value !== undefined) return;
  const name = s.name.trim();
  if (s.mode === 'add') {
    setTags([...tags.value, name]);
    setRules(rules.value.map((r) => ({
      ...r,
      barcodes: { ...r.barcodes, [name]: '' },
    })));
  } else {
    const oldName = s.oldName;
    if (oldName === name) {
      closeTagDialog();
      return;
    }
    setTags(tags.value.map((t) => (t === oldName ? name : t)));
    setRules(rules.value.map((r) => {
      const { [oldName]: value, ...rest } = r.barcodes;
      return { ...r, barcodes: { ...rest, [name]: value ?? '' } };
    }));
  }
  closeTagDialog();
}

function deleteTag(name: string) {
  setTags(tags.value.filter((t) => t !== name));
  setRules(rules.value.map((r) => {
    const { [name]: _drop, ...rest } = r.barcodes;
    return { ...r, barcodes: rest };
  }));
}

// --- Rule operations --------------------------------------------------------

function addRule() {
  const last = rules.value[rules.value.length - 1];
  const sampleGroupId = (last?.sampleGroupId ?? groupIds.value[0] ?? '') as PlId;
  const sampleId = (last?.sampleId ?? '') as PlId;
  const barcodes: Record<string, string> = {};
  for (const t of tags.value) barcodes[t] = '';
  setRules([...rules.value, { ruleId: uniquePlId(), sampleGroupId, sampleId, barcodes }]);
}

function deleteRules(ruleIds: string[]) {
  if (ruleIds.length === 0) return;
  const drop = new Set(ruleIds);
  setRules(rules.value.filter((r) => !drop.has(r.ruleId)));
}

// --- Grid setup -------------------------------------------------------------

type RuleRow = {
  ruleId: string;
  ruleIdx: number;
  sampleGroupId: string;
  sampleId: string;
  barcodes: Record<string, string>;
};

const gridApi = shallowRef<GridApi<RuleRow>>();

function onGridReady(p: GridReadyEvent<RuleRow>) {
  gridApi.value = p.api;
}

const rowData = computed<RuleRow[]>(() =>
  rules.value.map((r, ruleIdx) => ({
    ruleId: r.ruleId,
    ruleIdx,
    sampleGroupId: r.sampleGroupId,
    sampleId: r.sampleId,
    barcodes: r.barcodes,
  })),
);

const tagColIdPrefix = 'tag.';

const columnDefs = computed<ColDef<RuleRow>[]>(() => {
  const defs: ColDef<RuleRow>[] = [
    { ...makeRowNumberColDef(), suppressHeaderMenuButton: true },
    {
      colId: 'sampleGroupId',
      field: 'sampleGroupId',
      headerName: 'Sample Group',
      editable: true,
      minWidth: 160,
      flex: 1,
      suppressHeaderMenuButton: true,
      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorPopup: true,
      cellEditorParams: () => ({
        values: groupIds.value,
        formatValue: (v: string) => groupIdToLabel.value[v] ?? v,
        searchType: 'matchAny',
        allowTyping: true,
        filterList: true,
        highlightMatch: true,
      }),
      valueFormatter: (p) => groupIdToLabel.value[p.value as string] ?? (p.value as string),
    },
    {
      colId: 'sampleId',
      field: 'sampleId',
      headerName: 'Sample',
      editable: true,
      minWidth: 160,
      flex: 1,
      suppressHeaderMenuButton: true,
      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorPopup: true,
      cellEditorParams: () => ({
        values: sampleIds.value,
        formatValue: (v: string) => sampleIdToLabel.value[v] ?? v,
        searchType: 'matchAny',
        allowTyping: true,
        filterList: true,
        highlightMatch: true,
      }),
      valueFormatter: (p) => sampleIdToLabel.value[p.value as string] ?? (p.value as string),
    },
    ...tags.value.map((tag): ColDef<RuleRow> => ({
      colId: `${tagColIdPrefix}${tag}`,
      headerName: tag,
      editable: true,
      minWidth: 120,
      flex: 1,
      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
      valueGetter: (p) => p.data?.barcodes?.[tag] ?? '',
      valueSetter: (p) => {
        // Updating the model in onCellValueChanged below; valueSetter must
        // mutate p.data to make the grid re-render the cell synchronously.
        if (!p.data) return false;
        p.data.barcodes = { ...p.data.barcodes, [tag]: String(p.newValue ?? '') };
        return true;
      },
    })),
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

  return defs;
});

const defaultColDef: ColDef<RuleRow> = {
  suppressHeaderMenuButton: false,
};

const gridOptions = computed<GridOptions<RuleRow>>(() => ({
  getRowId: (p) => p.data.ruleId,

  rowSelection: {
    mode: 'multiRow',
    checkboxes: false,
    headerCheckbox: false,
  },

  stopEditingWhenCellsLoseFocus: true,
  singleClickEdit: false,

  onColumnHeaderClicked: (event) => {
    const columnId = event.column.getId();
    if (columnId === 'add') {
      event.api.showColumnMenu('add');
    }
  },

  onCellValueChanged: async (event) => {
    const row = event.data;
    if (!row) return;
    const idx = row.ruleIdx;
    const colId = event.column.getId();

    const next = [...rules.value];
    if (colId === 'sampleGroupId') {
      next[idx] = { ...next[idx], sampleGroupId: row.sampleGroupId as PlId };
    } else if (colId === 'sampleId') {
      next[idx] = { ...next[idx], sampleId: row.sampleId as PlId };
    } else if (colId.startsWith(tagColIdPrefix)) {
      const tag = colId.slice(tagColIdPrefix.length);
      next[idx] = {
        ...next[idx],
        barcodes: { ...next[idx].barcodes, [tag]: String(event.newValue ?? '') },
      };
    } else {
      return;
    }
    setRules(next);
    await app.allSettled();
  },

  getMainMenuItems: (params) => {
    const colId = params.column?.getId();
    if (!colId) return [];
    if (colId === 'add') {
      return [
        { name: 'Add Tag', action: () => openAddTag() },
      ];
    }
    if (colId.startsWith(tagColIdPrefix)) {
      const tag = colId.slice(tagColIdPrefix.length);
      return [
        { name: `Rename ${tag}`, action: () => openRenameTag(tag) },
        { name: `Delete ${tag}`, action: () => deleteTag(tag) },
      ];
    }
    return [];
  },

  getContextMenuItems: (params) => {
    const targetIds = getSelectedRuleIds(params.node ?? null);
    if (targetIds.length === 0) return [];
    return [
      {
        name: targetIds.length > 1 ? `Delete ${targetIds.length} rules` : 'Delete rule',
        action: () => deleteRules(targetIds),
      },
    ];
  },
}));

function getSelectedRuleIds(node: IRowNode<RuleRow> | null): string[] {
  const selected = gridApi.value?.getSelectedRows().map((r) => r.ruleId) ?? [];
  if (selected.length > 0) return selected;
  if (node?.data?.ruleId) return [node.data.ruleId];
  return [];
}
</script>

<template>
  <div class="multiplexing-rules">
    <PlAlert v-if="tags.length === 0" type="warn">
      No barcode tags declared yet. Click the
      <strong>+</strong> column header on the right of the grid and choose
      <em>Add Tag</em> to get started.
    </PlAlert>

    <div class="multiplexing-rules__grid">
      <AgGridVue
        :theme="AgGridTheme"
        :style="{ height: '100%' }"
        :rowData="rowData"
        :columnDefs="columnDefs"
        :defaultColDef="defaultColDef"
        :grid-options="gridOptions"
        :noRowsOverlayComponent="PlAgOverlayNoRows"
        @grid-ready="onGridReady"
      />
    </div>

    <div class="multiplexing-rules__footer">
      <PlBtnSecondary icon="add" :disabled="tags.length === 0" @click="addRule">
        Add rule
      </PlBtnSecondary>
    </div>

    <!-- Add / rename tag dialog -->
    <PlDialogModal
      :model-value="tagDialog.state.mode !== 'closed'"
      closable
      @update:model-value="(v) => { if (!v) closeTagDialog(); }"
    >
      <template #title>
        {{ tagDialog.state.mode === 'rename' ? 'Rename Tag' : 'Add Tag' }}
      </template>

      <PlTextField
        v-if="tagDialog.state.mode !== 'closed'"
        :model-value="tagDialog.state.name"
        label="Tag name"
        placeholder="e.g. P5, P7, BarcodeID"
        :error="tagDialogError"
        @update:model-value="(v: string) => { if (tagDialog.state.mode !== 'closed') tagDialog.state.name = v; }"
      />

      <template #actions>
        <PlBtnPrimary :disabled="tagDialogError !== undefined" @click="commitTagDialog">
          {{ tagDialog.state.mode === 'rename' ? 'Rename' : 'Add' }}
        </PlBtnPrimary>
        <PlBtnGhost @click="closeTagDialog">Cancel</PlBtnGhost>
      </template>
    </PlDialogModal>
  </div>
</template>

<style scoped>
.multiplexing-rules {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.multiplexing-rules__grid {
  flex: 1 1 auto;
  min-height: 240px;
}

.multiplexing-rules__footer {
  display: flex;
  justify-content: flex-start;
}
</style>

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
