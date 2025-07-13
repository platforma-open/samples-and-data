<script setup lang="ts">
import type {
  BlockArgs,
  DatasetContentFasta,
  DatasetContentFastq,
  DatasetContentMultilaneFastq,
} from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle, PlId } from '@platforma-sdk/model';
import { getFilePathFromHandle } from '@platforma-sdk/model';
import type {
  ListOption,
} from '@platforma-sdk/ui-vue';
import {
  PlBtnGhost,
  PlBtnGroup,
  PlBtnPrimary,
  PlBtnSecondary,
  PlCheckbox,
  PlDialogModal,
  PlDropdown,
  PlFileDialog,
  PlRow,
  PlTextField,
} from '@platforma-sdk/ui-vue';
import { computed, reactive, watch } from 'vue';
import { useApp } from '../../app';
import {
  createGetOrCreateSample,
  extractFileName,
  getDsReadIndices,
  modesOptions,
  readIndicesOptions,
  useParsedFiles,
  usePatternCompilation,
} from '../../datasets';
import {
  getWellFormattedReadIndex,
  inferFileNamePattern,
} from '../../file_name_parser';
import ParsedFilesList from '../components/ParsedFilesList.vue';

const emit = defineEmits<{ onClose: [] }>();

const app = useApp();

const props = defineProps<{
  targetDataset: PlId;
}>();

const presetTargetDataset = computed(() => {
  return app.model.args.datasets.find((ds) => ds.id === props.targetDataset);
});

function doClose() {
  app.showImportDataset = false;
  emit('onClose');
}

const resetData = () => {
  return {
    isPresetExists: !!presetTargetDataset.value?.id,
    targetAddDataset: presetTargetDataset.value?.id,
    gzipped: presetTargetDataset.value?.content.gzipped ?? false,
    readIndices: presetTargetDataset.value?.content.type === 'Fastq' || presetTargetDataset.value?.content.type === 'MultilaneFastq'
      ? presetTargetDataset.value.content.readIndices
      : [] as string[],
    files: [] as ImportFileHandle[],
    newDatasetLabel: app.inferNewDatasetLabel(),
    pattern: '',
    fileDialogOpened: true,
    datasetDialogOpened: false,
    importing: false,
  };
};

const data = reactive(resetData());

watch([props, presetTargetDataset], () => {
  Object.assign(data, resetData());
});

const isOneOfDialogsOpened = computed(() => data.fileDialogOpened || data.datasetDialogOpened);

watch(isOneOfDialogsOpened, (v) => {
  if (!v) {
    doClose();
  }
});

const { patternError, compiledPattern } = usePatternCompilation(data);

const parsedFiles = useParsedFiles(data, compiledPattern);

const hasMatchedFiles = computed(() => parsedFiles.value.filter((f) => f.match).length > 0);

function addFiles(files: ImportFileHandle[]) {
  const fileNames = files.map((h) => extractFileName(getFilePathFromHandle(h)));
  if (data.files.length === 0) {
    const pds = presetTargetDataset.value;

    if (!pds) {
      return alert('Dataset has been deleted');
    }

    const inferredPattern = inferFileNamePattern(fileNames, { expectedReadIndices: getDsReadIndices(pds), isGzipped: pds.content.gzipped });

    if (inferredPattern) {
      data.pattern = inferredPattern.pattern.rawPattern;
      data.gzipped = inferredPattern.extension.endsWith('.gz');
      data.readIndices = inferredPattern.readIndices;
    }
    // @todo add some meaningful notification if failed to infer pattern
  }
  data.files.push(...files);
  data.datasetDialogOpened = true;
}

const addToExistingOptions = computed<ListOption<PlId>[]>(() => {
  return app.model.args.datasets
    .map((ds) => ({
      value: ds.id,
      label: ds.label,
    }));
});

function addFastaDatasetContent(args: BlockArgs, contentData: DatasetContentFasta['data']) {
  const getOrCreateSample = createGetOrCreateSample(args);

  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error('Dataset has read or lane matcher, trying to add fasta dataset');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(sample);
    contentData[sampleId] = f.handle;
  }
}

function addFastqDatasetContent(args: BlockArgs, contentData: DatasetContentFastq['data']) {
  const getOrCreateSample = createGetOrCreateSample(args);

  if (compiledPattern.value?.hasLaneMatcher)
    throw new Error('Dataset has no lanes, trying to add data with lanes');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(sample);
    const readIndex = getWellFormattedReadIndex(f.match);
    let fileGroup = contentData[sampleId];
    if (!fileGroup) {
      fileGroup = {};
      contentData[sampleId] = fileGroup;
    }
    fileGroup[readIndex] = f.handle;
  }
}

function addMultilaneFastqDatasetContent(
  args: BlockArgs,
  contentData: DatasetContentMultilaneFastq['data'],
) {
  const getOrCreateSample = createGetOrCreateSample(args);

  if (!compiledPattern.value?.hasLaneMatcher)
    throw new Error('Dataset has lanes, trying to add data without lanes');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(sample);
    const lane = f.match.lane!.value;
    const readIndex = getWellFormattedReadIndex(f.match);

    let laneGroup = contentData[sampleId];
    if (!laneGroup) {
      laneGroup = {};
      contentData[sampleId] = laneGroup;
    }

    let fileGroup = laneGroup[lane];
    if (!fileGroup) {
      fileGroup = {};
      laneGroup[lane] = fileGroup;
    }

    fileGroup[readIndex] = f.handle;
  }
}

async function add() {
  try {
    data.importing = true;
    await addToExistingDataset();
  } finally {
    doClose();
  }
}

async function addToExistingDataset() {
  const datasetId = data.targetAddDataset;

  if (!datasetId) {
    return alert(`Dataset has been deleted.`);
  }

  await app.updateArgs((args) => {
    const dataset = args.datasets.find((ds) => ds.id === datasetId);
    if (dataset === undefined) throw new Error('Dataset not found');
    if (dataset.content.type === 'Fasta') addFastaDatasetContent(args, dataset.content.data);
    if (dataset.content.type === 'Fastq') addFastqDatasetContent(args, dataset.content.data);
    else if (dataset.content.type === 'MultilaneFastq')
      addMultilaneFastqDatasetContent(args, dataset.content.data);
    else throw new Error('Unknown dataset type');
  });

  await app.navigateTo(`/dataset?id=${datasetId}`);
}

const canAdd = computed(
  () =>
    hasMatchedFiles.value
    && (data.targetAddDataset !== undefined)
    // This prevents selecting fasta as type while having read index matcher in pattern
    && (data.readIndices.length !== 0
      || (compiledPattern.value?.hasReadIndexMatcher === false
        && compiledPattern.value?.hasLaneMatcher === false)),
);
</script>

<template>
  <PlDialogModal v-model="data.datasetDialogOpened" width="70%" :close-on-outside-click="false">
    <template #title>Add files to {{ presetTargetDataset?.label }}</template>

    <!-- Fake -->
    <PlBtnGroup model-value="add-to-existing" :options="modesOptions" disabled />

    <PlRow alignCenter>
      <PlDropdown v-model="data.targetAddDataset" :options="addToExistingOptions" class="flex-grow-1" :disabled="true" />
      <PlBtnGroup
        :model-value="JSON.stringify(data.readIndices)"
        :style="{ width: '200px' }"
        :options="readIndicesOptions"
        :disabled="true"
        @update:model-value="(v) => (data.readIndices = JSON.parse(v))"
      />
      <PlCheckbox v-model="data.gzipped" :disabled="true"> Gzipped </PlCheckbox>
    </PlRow>

    <PlTextField v-model="data.pattern" label="Pattern" :error="patternError" />

    <ParsedFilesList :items="parsedFiles" />

    <PlBtnSecondary @click="() => (data.fileDialogOpened = true)"> + add more files</PlBtnSecondary>

    <template #actions>
      <PlBtnPrimary :disabled="!canAdd" :loading="data.importing" @click="add">
        Add
      </PlBtnPrimary>

      <PlBtnGhost @click.stop="() => doClose()">Cancel</PlBtnGhost>
    </template>
  </PlDialogModal>

  <PlFileDialog
    v-model="data.fileDialogOpened"
    :close-on-outside-click="false"
    :multi="true"
    title="Select files to import"
    @import:files="(e) => addFiles(e.files)"
  />
</template>
