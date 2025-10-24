<script setup lang="ts">
import type {
  DSContentBulkCountMatrix,
  DSContentCellRangerMtx,
  DSContentFasta,
  DSContentFastq,
  DSContentMultilaneFastq,
  DSContentTaggedFastq,
  DSContentTaggedXsv,
  DSContentXsv,
  DSType,
  PlId,
  ReadIndices,
} from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle } from '@platforma-sdk/model';
import { getFileNameFromHandle, getFilePathFromHandle, uniquePlId } from '@platforma-sdk/model';
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
import * as _ from 'radashi';
import { computed, reactive, ref, watch } from 'vue';
import { useApp } from '../app';
import type { ImportMode } from './datasets';
import {
  datasetTypes,
  extractFileName,
  getOrCreateSample,
  modesOptions,
  useParsedFiles,
  usePatternCompilation,
} from './datasets';
import type {
  FileContentType,
  FileNamePattern,
} from './file_name_parser';
import {
  getWellFormattedReadIndex,
  inferFileNamePattern,
  normalizeCellRangerFileRole,
} from './file_name_parser';
import ParsedFilesList from './ParsedFilesList.vue';

type ImportDatasetDialogData = {
  /**
   * Import mode: create new dataset or add to existing dataset
   */
  mode: ImportMode;
  /**
   * Target dataset to add to if create new dataset is selected
   */
  targetAddDataset: PlId | undefined;
  /**
   * Type of the dataset to create; undefined means not yet inferred from the files or set by the user
   */
  datasetType: DSType | undefined;
  /**
   * Type of the files in the dataset
   */
  fileType: FileContentType | undefined;
  /**
   * Whether the dataset has tags
   */
  hasTags: boolean;
  /**
   * Whether the files are gzipped
   */
  gzipped: boolean;
  /**
   * Read indices that present in the files
   */
  readIndices: string[];
  /**
   * Files to import
   */
  files: ImportFileHandle[];
  /**
   * Pattern to match the files
   */
  pattern: string;
  /**
   * Whether the file dialog is opened
   */
  fileDialogOpened: boolean;
  /**
   * Whether the dataset dialog is opened
   */
  datasetDialogOpened: boolean;
  /**
   * Whether the dataset is being imported from the file dialog
   */
  importing: boolean;
  /**
   * Label for the new dataset
   */
  newDatasetLabel: string;
};

const emit = defineEmits<{ onClose: [navigated: boolean] }>();

const props = defineProps<{
  /** When specified, we are fixed to adding to a specific dataset */
  targetDataset?: PlId;
}>();

/** Case when importing to an existing dataset */
const targetDs = computed(() => {
  if (props.targetDataset)
    return app.model.args.datasets.find((ds) => ds.id === props.targetDataset);
  else
    return undefined;
});

/** Whether importing to an existing dataset */
const addingToFixedDataset = computed(() => targetDs.value !== undefined);

/** Read indices of the target dataset if importing to an existing dataset */
const targetDsReadIndices = computed(() => {
  const ds = targetDs.value;
  if (ds && (ds.content.type === 'Fastq' || ds.content.type === 'MultilaneFastq'))
    return ds.content.readIndices;
  else
    return ['R1'];
});

const app = useApp();

/**
 * Whether the user has navigated to the dataset page
 */
const navigated = ref(false);

function doClose() {
  app.showImportDataset = false;
  emit('onClose', navigated.value);
}

const data = reactive<ImportDatasetDialogData>({
  mode: targetDs.value ? 'add-to-existing' : 'create-new-dataset',
  targetAddDataset: targetDs.value?.id,
  datasetType: targetDs.value?.content.type,
  fileType: targetDs.value ? datasetTypes[targetDs.value.content.type].fileType : undefined,
  hasTags: targetDs.value ? datasetTypes[targetDs.value.content.type].hasTags : false,
  gzipped: targetDs.value?.content.gzipped ?? false,
  readIndices: targetDsReadIndices.value,
  files: [],
  newDatasetLabel: app.inferNewDatasetLabel(),
  pattern: '',
  fileDialogOpened: true,
  datasetDialogOpened: false,
  importing: false,
});

const isOneOfDialogsOpened = computed(() => data.fileDialogOpened || data.datasetDialogOpened);

watch(isOneOfDialogsOpened, (v) => {
  if (!v) {
    doClose();
  }
});

// Pattern compilation and file name matching
const { patternError, compiledPattern } = usePatternCompilation(data);

function updateDataFromPattern(v: FileNamePattern | undefined) {
  if (v && !addingToFixedDataset.value) {
    data.datasetType = v.datasetType;
    data.fileType = v.fileContentType;
    data.hasTags = v.hasTagMatchers;
    data.gzipped = v.gzipped;
  }
}

watch(compiledPattern, (v) => updateDataFromPattern(v));

// Parsed files
const parsedFiles = useParsedFiles(data, compiledPattern);

// Whether any of the files matched the pattern
const hasMatchedFiles = computed(() => parsedFiles.value.filter((f) => f.match).length > 0);

const dsTypeOptions = computed(() => {
  if (!data.fileType) {
    return [];
  }
  const result = [];
  for (const [value, props] of Object.entries(datasetTypes)) {
    if (props.fileType === data.fileType && props.hasTags === data.hasTags) {
      result.push({ value, label: props.label });
    }
  }
  return result;
});

// Add more files to the data
function addFiles(files: ImportFileHandle[]) {
  const fileNames = files.map((h) => extractFileName(getFilePathFromHandle(h)));
  if (data.files.length === 0) {
    const inferredPattern = inferFileNamePattern(fileNames);
    if (inferredPattern) {
      data.pattern = inferredPattern.pattern.rawPattern;
      updateDataFromPattern(inferredPattern.pattern);
      data.readIndices = inferredPattern.readIndices;
    }
    // @todo add some meaningful notification if failed to infer pattern
  }
  data.files.push(...files);
  data.datasetDialogOpened = true;
}

const addToExistingOptions = computed<ListOption<PlId>[]>(() => {
  const types = new Set(dsTypeOptions.value.map((o) => o.value));
  return app.model.args.datasets
    .filter(
      (ds) =>
        types.has(ds.content.type),
    )
    .map((ds) => ({
      value: ds.id,
      label: ds.label,
    }));
});

watch(addToExistingOptions, (ops) => {
  if (data.targetAddDataset && ops.find((o) => o.value === data.targetAddDataset))
    return;
  if (ops.length === 0)
    data.targetAddDataset = undefined;
  else
    data.targetAddDataset = ops[0].value;
});

function getOrCreateGroup(groupLabels: Record<PlId, string>, groupName: string): PlId {
  const id = Object.entries(groupLabels).find(([, label]) => label === groupName)?.[0];
  if (id) return id as PlId;
  const newId = uniquePlId();
  groupLabels[newId] = groupName;
  return newId;
}

/** FASTA */
function addFastaDatasetContent(
  contentData: DSContentFasta['data'],
) {
  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error('Dataset has read or lane matcher, trying to add fasta dataset');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    contentData[sampleId] = f.handle;
  }
}

/** FASTQ */
function addFastqDatasetContent(
  contentData: DSContentFastq['data'],
) {
  if (compiledPattern.value?.hasLaneMatcher)
    throw new Error('Dataset has no lanes, trying to add data with lanes');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    const readIndex = getWellFormattedReadIndex(f.match);
    let fileGroup = contentData[sampleId];
    if (!fileGroup) {
      fileGroup = {};
      contentData[sampleId] = fileGroup;
    }
    fileGroup[readIndex] = f.handle;
  }
}

/** MULTI-LANE FASTQ */
function addMultilaneFastqDatasetContent(
  contentData: DSContentMultilaneFastq['data'],
) {
  if (!compiledPattern.value?.hasLaneMatcher)
    throw new Error('Dataset has lanes, trying to add data without lanes');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
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

/** TAGGED FASTQ */
function addTaggedFastqDatasetContent(
  contentData: DSContentTaggedFastq['data'],
) {
  const pattern = compiledPattern.value;
  if (!pattern)
    throw new Error('No pattern');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    const lane = f.match.lane?.value;
    const readIndex = getWellFormattedReadIndex(f.match);
    const tags = _.mapValues(f.match.tags!, (v) => v.value);

    let sampleRecords = contentData[sampleId];
    if (!sampleRecords) {
      sampleRecords = [];
      contentData[sampleId] = sampleRecords;
    }

    let sampleRecord = sampleRecords.find((r) => r.lane === lane && _.isEqual(r.tags, tags));
    if (!sampleRecord)
      sampleRecords.push(sampleRecord = {
        tags, lane, files: {},
      });

    sampleRecord.files[readIndex] = f.handle;
  }
}

/** XSV */
function addXsvDatasetContent(
  contentData: DSContentXsv['data'],
) {
  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error('Dataset has read or lane matcher, trying to add XSV dataset');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    contentData[sampleId] = f.handle;
  }
}

/** TAGGED XSV */
function addTaggedXsvDatasetContent(
  contentData: DSContentTaggedXsv['data'],
) {
  const pattern = compiledPattern.value;
  if (!pattern)
    throw new Error('No pattern');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    const tags = _.mapValues(f.match.tags!, (v) => v.value);

    let sampleRecords = contentData[sampleId];
    if (!sampleRecords) {
      sampleRecords = [];
      contentData[sampleId] = sampleRecords;
    }

    let sampleRecord = sampleRecords.find((r) => _.isEqual(r.tags, tags));
    if (!sampleRecord)
      sampleRecords.push(sampleRecord = {
        tags, file: f.handle,
      });
  }
}

/** CellRanger MTX */
function addCellRangerMtxDatasetContent(
  contentData: DSContentCellRangerMtx['data'],
) {
  for (const f of parsedFiles.value) {
    if (!f.match || !f.match.cellRangerFileRole) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    const role = normalizeCellRangerFileRole(f.match.cellRangerFileRole.value);
    
    let fileGroup = contentData[sampleId];
    if (!fileGroup) {
      fileGroup = {};
      contentData[sampleId] = fileGroup;
    }
    fileGroup[role] = f.handle;
  }
}

/** Bulk Count Matrix */
function addBulkCountMatrixDatasetContent(
  groupLabels: Record<PlId, string>,
  contentData: DSContentBulkCountMatrix['data'],
) {
  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error('Dataset has read or lane matcher, trying to add XSV dataset');

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const group = f.match.sample.value;
    const sampleId = getOrCreateGroup(groupLabels, group);
    contentData[sampleId] = f.handle;
  }
}

async function createOrAdd() {
  try {
    data.importing = true;
    console.log('createOrAdd', data.mode);
    if (data.mode === 'add-to-existing')
      await addToExistingDataset();
    else
      await createNewDataset();
  } finally {
    doClose();
  }
}

async function addToExistingDataset() {
  const datasetId = data.targetAddDataset!;
  const dataset = app.model.args.datasets.find((ds) => ds.id === datasetId);
  if (dataset === undefined)
    throw new Error('Dataset not found');

  switch (dataset.content.type) {
    case 'Fasta':
      addFastaDatasetContent(dataset.content.data);
      break;
    case 'Fastq':
      addFastqDatasetContent(dataset.content.data);
      break;
    case 'MultilaneFastq':
      addMultilaneFastqDatasetContent(dataset.content.data);
      break;
    case 'Xsv':
      addXsvDatasetContent(dataset.content.data);
      break;
    case 'TaggedXsv':
      addTaggedXsvDatasetContent(dataset.content.data);
      break;
    case 'CellRangerMTX':
      addCellRangerMtxDatasetContent(dataset.content.data);
      break;
    case 'BulkCountMatrix':
      addBulkCountMatrixDatasetContent(dataset.content.groupLabels, dataset.content.data);
      break;
    default:
      throw new Error('Unknown dataset type');
  }

  await app.navigateTo(`/dataset?id=${datasetId}`);
  navigated.value = true;
}

const xsvType = (): 'csv' | 'tsv' => {
  const fileNames = data.files.map((f) => getFileNameFromHandle(f));
  if (fileNames.every((f) => f.endsWith('.csv') || f.endsWith('.csv.gz'))) return 'csv';
  if (fileNames.every((f) => f.endsWith('.tsv') || f.endsWith('.tsv.gz'))) return 'tsv';
  throw new Error('Files are not all csv or tsv');
};

async function createNewDataset() {
  const newDatasetId = uniquePlId();

  const pattern = compiledPattern.value;
  const datasetType = data.datasetType;
  if (!datasetType)
    throw new Error('Dataset type is not set');
  if (!pattern)
    throw new Error('Pattern type is not set');
  switch (datasetType) {
    case 'TaggedXsv': {
      const contentData: DSContentTaggedXsv['data'] = {};
      addTaggedXsvDatasetContent(contentData);
      app.model.args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'TaggedXsv',
          xsvType: xsvType(),
          gzipped: data.gzipped,
          tags: pattern.tags,
          data: contentData,
        },
      });
      break;
    }
    case 'Xsv':{
      const contentData: DSContentXsv['data'] = {};
      addXsvDatasetContent(contentData);
      app.model.args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'Xsv',
          xsvType: xsvType(),
          gzipped: data.gzipped,
          data: contentData,
        },
      });
      break;
    } case 'Fasta': {
      const contentData: DSContentFasta['data'] = {};
      addFastaDatasetContent(contentData);

      app.model.args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'Fasta',
          gzipped: data.gzipped,
          data: contentData,
        },
      });
      break;
    } case 'TaggedFastq': {
      const contentData: DSContentTaggedFastq['data'] = {};
      addTaggedFastqDatasetContent(contentData);

      app.model.args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'TaggedFastq',
          gzipped: data.gzipped,
          tags: pattern.tags,
          hasLanes: pattern.hasLaneMatcher,
          readIndices: data.readIndices as ReadIndices,
          data: contentData,
        },
      });
      break;
    } case 'MultilaneFastq': {
      const contentData: DSContentMultilaneFastq['data'] = {};
      addMultilaneFastqDatasetContent(contentData);

      app.model.args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'MultilaneFastq',
          gzipped: data.gzipped,
          readIndices: data.readIndices as ReadIndices,
          data: contentData,
        },
      });
      break;
    } case 'Fastq': {
      const contentData: DSContentFastq['data'] = {};
      addFastqDatasetContent(contentData);

      app.model.args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'Fastq',
          gzipped: data.gzipped,
          readIndices: data.readIndices as ReadIndices,
          data: contentData,
        },
      });
      break;
    } case 'CellRangerMTX': {
      const contentData: DSContentCellRangerMtx['data'] = {};
      addCellRangerMtxDatasetContent(contentData);

      app.model.args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'CellRangerMTX',
          gzipped: data.gzipped,
          data: contentData,
        },
      });
      break;
    } case 'BulkCountMatrix': {
      const groupLabels: Record<PlId, string> = {};
      const contentData: DSContentBulkCountMatrix['data'] = {};
      addBulkCountMatrixDatasetContent(groupLabels, contentData);

      app.model.args.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: 'BulkCountMatrix',
          gzipped: data.gzipped,
          xsvType: xsvType(),
          sampleGroups: undefined,
          data: contentData,
          groupLabels: groupLabels,
        },
      });
      break;
    }
    default:
      throw new Error('Unknown dataset type: ' + datasetType);
  }
  await app.allSettled();
  await app.navigateTo(`/dataset?id=${newDatasetId}`);
  navigated.value = true;
}

const canCreateOrAdd = computed(
  () => {
    console.log('targetDs', targetDs.value);
    console.log('data', data);
    console.log('canCreateOrAdd', hasMatchedFiles.value, data.mode, data.targetAddDataset, data.datasetType, data.readIndices, compiledPattern.value?.hasReadIndexMatcher, compiledPattern.value?.hasLaneMatcher);
    return hasMatchedFiles.value
      && (data.mode === 'create-new-dataset' || data.targetAddDataset !== undefined)
      && data.datasetType !== undefined
    // This prevents selecting fasta as type while having read index matcher in pattern
      && (data.readIndices.length !== 0
        || (compiledPattern.value?.hasReadIndexMatcher === false
          && compiledPattern.value?.hasLaneMatcher === false));
  },
);
</script>

<template>
  <PlDialogModal
    v-model="data.datasetDialogOpened"
    width="70%"
    :close-on-outside-click="false"
  >
    <template #title>Import files</template>

    <PlBtnGroup v-model="data.mode" :options="modesOptions" :disabled="addingToFixedDataset" />

    <PlRow alignCenter>
      <PlTextField
        v-if="data.mode === 'create-new-dataset'"
        v-model="data.newDatasetLabel"
        label="Dataset Name"
        class="flex-grow-1"
        :disabled="addingToFixedDataset"
      />
      <PlDropdown
        v-else v-model="data.targetAddDataset"
        :options="addToExistingOptions"
        :disabled="addingToFixedDataset"
        label="Dataset"
        placeholder="Select dataset"
        required
        class="flex-grow-1"
      />
      <PlDropdown
        v-model="data.datasetType"
        :options="dsTypeOptions"
        :required="true"
        :disabled="data.datasetType && addingToFixedDataset"
        label="Type"
        error=""
        placeholder="Select type"
        :style="{ flexBasis: '180px', flexShrink: 0 }"
      />

      <PlCheckbox v-model="data.gzipped" disabled > Gzipped </PlCheckbox>
    </PlRow>

    <PlTextField
      v-model="data.pattern"
      label="Pattern"
      :error="patternError"
    />

    <ParsedFilesList :items="parsedFiles" />

    <PlBtnSecondary
      @click="() => (data.fileDialogOpened = true)"
    >
      + add more files
    </PlBtnSecondary>

    <template #actions>
      <PlBtnPrimary
        :disabled="!canCreateOrAdd"
        :loading="data.importing"
        @click="createOrAdd"
      >
        {{ data.mode === 'create-new-dataset' ? 'Create' : 'Add' }}
      </PlBtnPrimary>

      <PlBtnGhost
        @click.stop="() => doClose()"
      >
        Cancel
      </PlBtnGhost>
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
