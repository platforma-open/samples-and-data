<script setup lang="ts">
import {
  BlockArgs,
  DatasetContentFasta,
  DatasetContentFastq,
  DatasetContentMultilaneFastq,
  DatasetContentTaggedFastq,
  DatasetContentTaggedXsv,
  DatasetContentXsv,
  PlId,
  ReadIndices,
  uniquePlId
} from '@platforma-open/milaboratories.samples-and-data.model';
import { getFileNameFromHandle, getFilePathFromHandle, ImportFileHandle } from '@platforma-sdk/model';
import {
  ListOption,
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
import * as _ from 'radashi';
import { computed, reactive, watch } from 'vue';
import { useApp } from '../app';
import type { ImportMode } from '../datasets';
import { createGetOrCreateSample, extractFileName, modesOptions, readIndicesOptions, useParsedFiles, usePatternCompilation } from '../datasets';
import {
  getWellFormattedReadIndex,
  inferFileNamePattern
} from '../file_name_parser';
import ParsedFilesList from '../ParsedFilesList.vue';

const emit = defineEmits<{ onClose: [] }>();

const app = useApp();

function doClose() {
  app.showImportDataset = false;
  emit('onClose');
}

const data = reactive({
  mode: 'create-new-dataset' as ImportMode,
  targetAddDataset: undefined as PlId | undefined,
  gzipped: false,
  readIndices: ['R1'] as string[],
  files: [] as ImportFileHandle[],
  newDatasetLabel: app.inferNewDatasetLabel(),
  pattern: '',
  fileDialogOpened: true,
  datasetDialogOpened: false,
  importing: false
});

const isOneOfDialogsOpened = computed(() => data.fileDialogOpened || data.datasetDialogOpened);

watch(isOneOfDialogsOpened, v => {
  if (!v) {
    doClose();
  }
});

// Pattern compilation and file name matching
const { patternError, compiledPattern } = usePatternCompilation(data);

const parsedFiles = useParsedFiles(data, compiledPattern);

const hasMatchedFiles = computed(() => parsedFiles.value.filter((f) => f.match).length > 0);

function addFiles(files: ImportFileHandle[]) {
  const fileNames = files.map((h) => extractFileName(getFilePathFromHandle(h)));
  if (data.files.length === 0) {
    const inferredPattern = inferFileNamePattern(fileNames);
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
  const { gzipped, readIndices } = data;
  return app.model.args.datasets
    .filter(
      (ds) =>
        (compiledPattern.value &&
          ds.content.type === (compiledPattern.value.hasLaneMatcher ? 'MultilaneFastq' : 'Fastq') &&
          ds.content.gzipped === gzipped &&
          JSON.stringify(ds.content.readIndices) === JSON.stringify(readIndices))
    )
    .map((ds) => ({
      value: ds.id,
      label: ds.label
    }));
});

watch(addToExistingOptions, (ops) => {
  if (data.targetAddDataset && ops.find(o => o.value === data.targetAddDataset)) return;
  if (ops.length === 0) data.targetAddDataset = undefined;
  else data.targetAddDataset = ops[0].value;
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
  contentData: DatasetContentMultilaneFastq['data']
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

function addTaggedFastqDatasetContent(
  args: BlockArgs,
  contentData: DatasetContentTaggedFastq['data']
) {
  const getOrCreateSample = createGetOrCreateSample(args);

  const pattern = compiledPattern.value;
  if (!pattern)
    throw new Error('No pattern');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(sample);
    const lane = f.match.lane?.value;
    const readIndex = getWellFormattedReadIndex(f.match);
    const tags = _.mapValues(f.match.tags!, v => v.value)

    let sampleRecords = contentData[sampleId];
    if (!sampleRecords) {
      sampleRecords = [];
      contentData[sampleId] = sampleRecords;
    }

    let sampleRecord = sampleRecords.find(r => r.lane === lane && _.isEqual(r.tags, tags));
    if (!sampleRecord)
      sampleRecords.push(sampleRecord = {
        tags, lane, files: {}
      })

    sampleRecord.files[readIndex] = f.handle;
  }
}


function addXsvDatasetContent(
  args: BlockArgs,
  contentData: DatasetContentXsv['data']
  ) {
  const getOrCreateSample = createGetOrCreateSample(args);
  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error('Dataset has read or lane matcher, trying to add XSV dataset');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(sample);
    contentData[sampleId] = f.handle;
  }
}

function addTaggedXsvDatasetContent(
  args: BlockArgs,
  contentData: DatasetContentTaggedXsv['data']
  ) {
  const getOrCreateSample = createGetOrCreateSample(args);

  const pattern = compiledPattern.value;
  if (!pattern)
    throw new Error('No pattern');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(sample);
    const tags = _.mapValues(f.match.tags!, v => v.value)

    let sampleRecords = contentData[sampleId];
    if (!sampleRecords) {
      sampleRecords = [];
      contentData[sampleId] = sampleRecords;
    }

    let sampleRecord = sampleRecords.find(r =>  _.isEqual(r.tags, tags));
    if (!sampleRecord)
      sampleRecords.push(sampleRecord = {
        tags, file: f.handle
      })

  }
}

async function createOrAdd() {
  try {
    data.importing = true;
    if (data.mode === 'add-to-existing') await addToExistingDataset();
    else await createNewDataset();
  } finally {
    doClose();
  }
}

async function addToExistingDataset() {
  const datasetId = data.targetAddDataset!;
  await app.updateArgs((args) => {
    const dataset = args.datasets.find((ds) => ds.id === datasetId);
    if (dataset === undefined) throw new Error('Dataset not found');
    else if (dataset.content.type === 'Fasta') addFastaDatasetContent(args, dataset.content.data);
    else if (dataset.content.type === 'Fastq') addFastqDatasetContent(args, dataset.content.data);
    else if (dataset.content.type === 'MultilaneFastq')
      addMultilaneFastqDatasetContent(args, dataset.content.data);
    else if (dataset.content.type === 'Xsv') addXsvDatasetContent(args, dataset.content.data);
    else if (dataset.content.type === 'TaggedXsv') addTaggedXsvDatasetContent(args, dataset.content.data);
    else throw new Error('Unknown dataset type');
  });
  app.navigateTo(`/dataset?id=${datasetId}`);
}

const isXsv = () => {
  return data.files.map(f => getFileNameFromHandle(f)).every(f => f.endsWith('.csv') || f.endsWith('.tsv'))
}

const xsvType = (): 'csv' | 'tsv' => {
  const fileNames = data.files.map(f => getFileNameFromHandle(f));
  if (fileNames.every(f => f.endsWith('.csv') || f.endsWith('.csv.gz'))) return 'csv';
  if (fileNames.every(f => f.endsWith('.tsv') || f.endsWith('.tsv.gz'))) return 'tsv';
  throw new Error('Files are not all csv or tsv');
}

async function createNewDataset() {
  const newDatasetId = uniquePlId();
  await app.updateArgs((args) => {
    const pattern = compiledPattern.value;
    if (isXsv() && pattern?.hasTagMatchers) {
      const contentData: DatasetContentTaggedXsv['data'] = {};
      addTaggedXsvDatasetContent(args, contentData);
      args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'TaggedXsv',
          xsvType: xsvType(),
          gzipped: data.gzipped,
          tags: pattern.tags,
          data: contentData
        }
      });
    } else if (isXsv()) {
      const contentData: DatasetContentXsv['data'] = {};
      addXsvDatasetContent(args, contentData);
      args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'Xsv',
          xsvType: xsvType(),
          gzipped: data.gzipped,
          data: contentData
        }
      });
    } 
    else if (data.readIndices.length === 0 /* fasta */) {
      const contentData: DatasetContentFasta['data'] = {};
      addFastaDatasetContent(args, contentData);

      args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'Fasta',
          gzipped: data.gzipped,
          data: contentData
        }
      });
    } else if (pattern?.hasTagMatchers) {
      const contentData: DatasetContentTaggedFastq['data'] = {};
      addTaggedFastqDatasetContent(args, contentData);

      args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'TaggedFastq',
          gzipped: data.gzipped,
          tags: pattern.tags,
          hasLanes: pattern.hasLaneMatcher,
          readIndices: ReadIndices.parse(data.readIndices),
          data: contentData
        }
      });
    } else if (pattern?.hasLaneMatcher) {
      const contentData: DatasetContentMultilaneFastq['data'] = {};
      addMultilaneFastqDatasetContent(args, contentData);

      args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'MultilaneFastq',
          gzipped: data.gzipped,
          readIndices: ReadIndices.parse(data.readIndices),
          data: contentData
        }
      });
    } else {
      const contentData: DatasetContentFastq['data'] = {};
      addFastqDatasetContent(args, contentData);

      args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'Fastq',
          gzipped: data.gzipped,
          readIndices: ReadIndices.parse(data.readIndices),
          data: contentData
        }
      });
    }
  });

  await app.navigateTo(`/dataset?id=${newDatasetId}`);
}

const canCreateOrAdd = computed(
  () =>
    hasMatchedFiles.value &&
    (data.mode === 'create-new-dataset' || data.targetAddDataset !== undefined) &&
    // This prevents selecting fasta as type while having read index matcher in pattern
    (data.readIndices.length !== 0 ||
      (compiledPattern.value?.hasReadIndexMatcher === false &&
        compiledPattern.value?.hasLaneMatcher === false))
);
</script>

<template>
  <PlDialogModal v-model="data.datasetDialogOpened" width="70%" :close-on-outside-click="false">
    <template #title>Import files</template>

    <PlBtnGroup v-model="data.mode" :options="modesOptions" />

    <PlRow alignCenter>
      <PlTextField v-if="data.mode === 'create-new-dataset'" label="Dataset Name" v-model="data.newDatasetLabel"
        class="flex-grow-1" />
      <PlDropdown v-else v-model="data.targetAddDataset" :options="addToExistingOptions" class="flex-grow-1" />
      <PlBtnGroup :model-value="JSON.stringify(data.readIndices)" :style="{ width: '200px' }"
        @update:model-value="(v) => (data.readIndices = JSON.parse(v))" :options="readIndicesOptions" />
      <PlCheckbox v-model="data.gzipped"> Gzipped </PlCheckbox>
    </PlRow>

    <PlTextField label="Pattern" v-model="data.pattern" :error="patternError" />

    <ParsedFilesList :items="parsedFiles" />

    <PlBtnSecondary @click="() => (data.fileDialogOpened = true)"> + add more files</PlBtnSecondary>

    <template #actions>
      <PlBtnPrimary :disabled="!canCreateOrAdd" @click="createOrAdd" :loading="data.importing">
        {{ data.mode === 'create-new-dataset' ? 'Create' : 'Add' }}
      </PlBtnPrimary>

      <PlBtnGhost @click.stop="() => doClose()">Cancel</PlBtnGhost>
    </template>
  </PlDialogModal>

  <PlFileDialog v-model="data.fileDialogOpened" :close-on-outside-click="false" :multi="true"
    title="Select files to import" @import:files="(e) => addFiles(e.files)" />
</template>
