<script setup lang="ts">
import type { MTColumn, PlId } from "@platforma-open/milaboratories.samples-and-data.model";
import { uniquePlId } from "@platforma-sdk/model";
import type { ListOption } from "@platforma-sdk/ui-vue";
import {
  isDefined,
  PlAlert,
  PlBtnGroup,
  PlBtnPrimary,
  PlBtnSecondary,
  PlCheckbox,
  PlDialogModal,
  PlDropdown,
  PlLogView,
  PlTextArea,
} from "@platforma-sdk/ui-vue";
import { computed, reactive, watch } from "vue";
import { useApp } from "../app";
import type { ImportResult } from "../dataimport";
import { determineBestMatchingAlgorithm } from "../sample_matching";
import {
  type ColumnTarget,
  defaultColumnMapping,
  isColumnTypeCompatible,
  type MetadataColumnMapping,
  populateMetadataFromRow,
  resolveMetadataColumns,
  TARGET_IGNORE,
  TARGET_NEW,
  unfilledExistingColumns,
} from "../utils/metadata";

const props = defineProps<{ importCandidate: ImportResult }>();

const emit = defineEmits<{ onClose: [] }>();

const app = useApp();

/**
 * `keep` leaves the project's metadata columns in place and lets every column
 * of the file choose what it does; `replace` deletes all existing columns and
 * rebuilds the metadata from the file alone.
 */
type ImportMode = "keep" | "replace";

const data = reactive<{
  sampleNameColumnIdx: number;
  addUnmatchedSamples: boolean;
  mode: ImportMode;
  mapping: MetadataColumnMapping;
}>({
  sampleNameColumnIdx: -1,
  addUnmatchedSamples: false,
  mode: "keep",
  mapping: {},
});

const existingMetadata = computed(() => app.model.data.metadata);
const hasExistingColumns = computed(() => existingMetadata.value.length > 0);

watch(
  () => props.importCandidate,
  (ic) => {
    data.sampleNameColumnIdx = ic.data.columns.findIndex((c) => c.header.includes("sample"));
    if (data.sampleNameColumnIdx === -1) data.sampleNameColumnIdx = 0;
  },
  { immediate: true },
);

// The sample name column feeds no metadata column, so a change of it invalidates
// the mapping; every column's action is re-derived from the column names.
watch(
  () => [props.importCandidate, data.sampleNameColumnIdx] as const,
  ([ic, sampleIdx]) => {
    data.mapping = defaultColumnMapping(existingMetadata.value, ic, [sampleIdx]);
  },
  { immediate: true },
);

const algo = computed(() =>
  determineBestMatchingAlgorithm(
    Object.values(app.model.data.sampleLabels).filter(isDefined),
    data.sampleNameColumnIdx === -1
      ? []
      : props.importCandidate.data.rows
          .map((r) => r[data.sampleNameColumnIdx])
          .filter(isDefined)
          .map((v) => String(v)),
  ),
);

const sampleColumnOptions = computed<ListOption<number>[]>(() =>
  props.importCandidate.data.columns.map((c, idx) => ({ value: idx, label: c.header })),
);

const modeOptions: ListOption<ImportMode>[] = [
  { value: "keep", label: "Keep existing columns" },
  { value: "replace", label: "Replace all metadata" },
];

/** Columns of the file the user chooses an action for: everything but the sample name. */
const mappableColumns = computed(() =>
  props.importCandidate.data.columns
    .map((c, idx) => ({ ...c, idx }))
    .filter(({ idx }) => idx !== data.sampleNameColumnIdx),
);

const NEW_VALUE = "new";
const IGNORE_VALUE = "ignore";
const EXISTING_PREFIX = "col:";

function targetToValue(target: ColumnTarget): string {
  switch (target.type) {
    case "new":
      return NEW_VALUE;
    case "ignore":
      return IGNORE_VALUE;
    case "existing":
      return EXISTING_PREFIX + target.columnId;
  }
}

function valueToTarget(value: string): ColumnTarget {
  if (value === NEW_VALUE) return TARGET_NEW;
  if (value === IGNORE_VALUE) return TARGET_IGNORE;
  return { type: "existing", columnId: value.slice(EXISTING_PREFIX.length) };
}

/**
 * What one column of the file may do: become a column of its own, fill any
 * existing column that can hold its values, or stay out of the project.
 */
function targetOptionsFor(column: { type: MTColumn["valueType"] }): ListOption<string>[] {
  const options: ListOption<string>[] = [{ value: NEW_VALUE, label: "Add as a new column" }];
  for (const mc of existingMetadata.value) {
    if (!isColumnTypeCompatible(mc.valueType, column.type)) continue;
    options.push({
      value: EXISTING_PREFIX + mc.id,
      label: `Fill "${mc.label}" (${mc.valueType})`,
    });
  }
  options.push({ value: IGNORE_VALUE, label: "Do not import" });
  return options;
}

function targetValueFor(idx: number): string {
  return targetToValue(data.mapping[idx] ?? TARGET_NEW);
}

function setTarget(idx: number, value: string | undefined) {
  if (value === undefined) return;
  data.mapping[idx] = valueToTarget(value);
}

/** Existing columns nothing in the file fills; they keep whatever they hold now. */
const unfilled = computed(() =>
  data.mode === "replace" ? [] : unfilledExistingColumns(existingMetadata.value, data.mapping),
);

/** Existing columns two or more file columns were pointed at. */
const doubleFilled = computed(() => {
  const counts = new Map<string, number>();
  for (const c of mappableColumns.value) {
    const target = data.mapping[c.idx];
    if (target?.type !== "existing") continue;
    counts.set(target.columnId, (counts.get(target.columnId) ?? 0) + 1);
  }
  return existingMetadata.value.filter((mc) => (counts.get(mc.id) ?? 0) > 1);
});

const resolved = computed(() =>
  resolveMetadataColumns({
    importCandidate: props.importCandidate,
    existingMetadata: data.mode === "replace" ? [] : existingMetadata.value,
    skipColumnIndices: [data.sampleNameColumnIdx],
    mapping: data.mode === "replace" ? {} : data.mapping,
  }),
);

/**
 * Columns added under a name other than their header, because the name was
 * already taken by a project column or by an earlier column of the file.
 */
const renamedColumns = computed(() => {
  const renamed: { header: string; label: string }[] = [];
  for (const c of mappableColumns.value) {
    const model = resolved.value.modelColumns[c.idx];
    if (!model || !resolved.value.newColumns.includes(model)) continue;
    if (model.label !== c.header) renamed.push({ header: c.header, label: model.label });
  }
  return renamed;
});

const tableDataText = computed(() => {
  const ic = props.importCandidate;
  const newCount = resolved.value.newColumns.length;
  const filledCount = resolved.value.modelColumns.filter(
    (c) => c !== undefined && !resolved.value.newColumns.includes(c),
  ).length;
  const ignoredCount = mappableColumns.value.length - newCount - filledCount;
  let result = "";
  result += `Matched samples: ${algo.value.matches} (out of ${app.model.data.sampleIds.length})\n`;
  result += `Unmatched rows: ${ic.data.rows.length - algo.value.matches}\n`;
  result += `File columns: ${mappableColumns.value.length}`;
  if (data.mode === "replace" && hasExistingColumns.value)
    result += ` (all ${newCount} added, replacing ${existingMetadata.value.length} existing)`;
  else result += ` (${newCount} added, ${filledCount} filling existing, ${ignoredCount} skipped)`;
  return result;
});

const tableIssuesText = computed(() => {
  const ic = props.importCandidate;
  if (ic.emptyColumns > 0 || ic.emptyRowsRemoved > 0 || ic.missingHeaders > 0) {
    let result = ``;
    if (ic.emptyColumns > 0) result += `Empty columns removed: ${ic.emptyColumns}\n`;
    if (ic.emptyRowsRemoved > 0) result += `Empty rows removed: ${ic.emptyRowsRemoved}\n`;
    if (ic.missingHeaders > 0) result += `Missing headers: ${ic.missingHeaders}\n`;
    return result;
  }
  return undefined;
});

function runImport() {
  const args = app.model.data;
  const { modelColumns, newColumns } = resolved.value;

  if (data.mode === "replace") args.metadata.splice(0, args.metadata.length);
  args.metadata.push(...newColumns);

  // Adding data
  const matcher = algo.value.topAlgorithm.matcher;
  const existingSamples = Object.entries(args.sampleLabels);
  for (const row of props.importCandidate.data.rows) {
    let iSampleName = row[data.sampleNameColumnIdx];
    if (!iSampleName) continue;
    if (typeof iSampleName === "number")
      // coerce to string
      iSampleName = String(iSampleName);
    let sampleId = existingSamples.find(
      ([, sLabel]) => sLabel && matcher(sLabel, iSampleName),
    )?.[0] as PlId | undefined;

    if (!sampleId) {
      if (!data.addUnmatchedSamples) continue;
      sampleId = uniquePlId();
      args.sampleIds.push(sampleId);
      args.sampleLabels[sampleId] = iSampleName;
    }

    populateMetadataFromRow(row, sampleId, modelColumns);
  }

  emit("onClose");
}
</script>

<template>
  <PlDialogModal
    :model-value="true"
    :close-on-outside-click="false"
    closable
    width="70%"
    @update:model-value="
      (v) => {
        if (!v) emit('onClose');
      }
    "
  >
    <template #title>Import metadata</template>
    <PlDropdown
      v-model="data.sampleNameColumnIdx"
      label="Sample name column"
      :options="sampleColumnOptions"
    />
    <PlCheckbox v-model="data.addUnmatchedSamples"> Add unmatched samples </PlCheckbox>

    <PlBtnGroup
      v-if="hasExistingColumns"
      v-model="data.mode"
      label="Metadata already in the project"
      :options="modeOptions"
    />

    <template v-if="data.mode === 'keep'">
      <PlDropdown
        v-for="column in mappableColumns"
        :key="column.idx"
        :model-value="targetValueFor(column.idx)"
        :label="`${column.header} (${column.type})`"
        :options="targetOptionsFor(column)"
        @update:model-value="(v) => setTarget(column.idx, v)"
      />

      <PlAlert v-if="doubleFilled.length > 0" type="warn" icon>
        Two or more file columns write into the same project column:
        {{ doubleFilled.map((c) => c.label).join(", ") }}. The rightmost one wins.
      </PlAlert>
      <PlAlert v-if="renamedColumns.length > 0" type="warn" icon>
        A name already in use cannot be taken twice, since two columns sharing a name are exported
        as one. Added under a new name:
        {{ renamedColumns.map((c) => `"${c.header}" as "${c.label}"`).join(", ") }}. Point the
        column at the existing one instead if it is meant to fill it.
      </PlAlert>
      <PlAlert v-if="unfilled.length > 0" type="info" icon>
        {{ unfilled.length }} project columns take nothing from this file:
        {{ unfilled.map((c) => c.label).join(", ") }}. They keep the values they have now.
      </PlAlert>
    </template>

    <PlAlert
      v-else-if="hasExistingColumns"
      type="warn"
      icon
      label="All existing metadata will be deleted"
    >
      {{ existingMetadata.length }} metadata columns and their values will be removed and replaced
      with the columns from the file. Blocks downstream that use the current columns will lose their
      settings: after the import, re-check the whole project and select the replacement columns
      again in every block that used the removed ones.
    </PlAlert>

    <PlLogView :value="tableDataText" label="Import information">
      <template #tooltip>Matching algorithm: {{ algo.topAlgorithm.name }}</template>
    </PlLogView>
    <template v-if="tableIssuesText">
      <PlTextArea
        :model-value="tableIssuesText"
        label="File issues"
        readonly
        :autogrow="true"
        :rows="1"
      />
    </template>

    <template #actions>
      <PlBtnPrimary @click="runImport">
        {{ data.mode === "replace" && hasExistingColumns ? "Replace metadata" : "Import" }}
      </PlBtnPrimary>
      <PlBtnSecondary @click="() => emit('onClose')">Cancel</PlBtnSecondary>
    </template>
  </PlDialogModal>
</template>
