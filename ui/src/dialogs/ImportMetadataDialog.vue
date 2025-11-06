<script setup lang="ts">
import type {
  MTColumn,
  PlId,
} from '@platforma-open/milaboratories.samples-and-data.model';
import { uniquePlId } from '@platforma-sdk/model';
import type {
  ListOption,
} from '@platforma-sdk/ui-vue';
import {
  isDefined,
  PlBtnPrimary,
  PlBtnSecondary,
  PlCheckbox,
  PlDialogModal,
  PlDropdown,
  PlLogView,
  PlTextArea,
} from '@platforma-sdk/ui-vue';
import { computed, reactive, watch } from 'vue';
import { useApp } from '../app';
import type { ImportResult } from '../dataimport';
import { determineBestMatchingAlgorithm } from '../sample_matching';
import {
  columnNamesMatch,
  populateMetadataFromRow,
  processMetadataColumns,
} from '../utils/metadata';

const props = defineProps<{ importCandidate: ImportResult }>();

const emit = defineEmits<{ onClose: [] }>();

const app = useApp();

const data = reactive({
  sampleNameColumnIdx: -1,
  addUnmatchedSamples: false,
});

watch(
  () => props.importCandidate,
  (ic) => {
    data.sampleNameColumnIdx = ic.data.columns.findIndex((c) => c.header.includes('sample'));
    if (data.sampleNameColumnIdx === -1) data.sampleNameColumnIdx = 0;
  },
  { immediate: true },
);

const algo = computed(() =>
  determineBestMatchingAlgorithm(
    Object.values(app.model.args.sampleLabels).filter(isDefined),
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


const colsMatchingExisting = computed(() => {
  let res = 0;
  for (const c of props.importCandidate.data.columns)
    if (app.model.args.metadata.find((mc) => columnNamesMatch(mc.label, c.header))) res++;
  return res;
});

const tableDataText = computed(() => {
  const ic = props.importCandidate;
  let result = '';
  result += `Matched samples: ${algo.value.matches} (out of ${app.model.args.sampleIds.length})\n`;
  result += `Unmatched rows: ${ic.data.rows.length - algo.value.matches}\n`;
  // result += `Matching algorithm: ${algo.value.topAlgorithm.name}\n`
  result += `Import meta columns: ${ic.data.columns.length} (${colsMatchingExisting.value} match existing)`;
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
  const args = app.model.args;

  // Process metadata columns using utility function
  const { modelColumns, newColumns } = processMetadataColumns({
    importCandidate: props.importCandidate,
    existingMetadata: args.metadata,
    skipColumnIndices: [data.sampleNameColumnIdx],
  });

  // Add new columns to the model
  args.metadata.push(...newColumns);

  // Adding data
  const matcher = algo.value.topAlgorithm.matcher;
  const existingSamples = Object.entries(args.sampleLabels);
  for (const row of props.importCandidate.data.rows) {
    let iSampleName = row[data.sampleNameColumnIdx];
    if (!iSampleName) continue;
    if (typeof iSampleName === 'number')
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

    // Populate metadata using utility function
    populateMetadataFromRow(row, sampleId, modelColumns);
  }

  emit('onClose');
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
      <PlBtnPrimary @click="runImport">Import</PlBtnPrimary>
      <PlBtnSecondary @click="() => emit('onClose')">Cancel</PlBtnSecondary>
    </template>
  </PlDialogModal>
</template>
