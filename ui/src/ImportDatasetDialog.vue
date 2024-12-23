<script setup lang="ts">
import {
  BlockArgs,
  DatasetContentFasta,
  DatasetContentFastq,
  DatasetContentMultilaneFastq,
  PlId,
  ReadIndices,
  uniquePlId
} from '@platforma-open/milaboratories.samples-and-data.model';
import { getFilePathFromHandle, ImportFileHandle } from '@platforma-sdk/model';
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
  SimpleOption
} from '@platforma-sdk/ui-vue';
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { useApp } from './app';
import {
  FileNamePattern,
  getWellFormattedReadIndex,
  inferFileNamePattern
} from './file_name_parser';
import ParsedFilesList from './ParsedFilesList.vue';
import { ParsedFile } from './types';

const app = useApp();

const emit = defineEmits<{ onClose: [] }>();

let closed = false;
function doClose() {
  if (closed) return;
  closed = true;
  emit('onClose');
}

const data = reactive({
  mode: 'create-new-dataset' as ImportMode,
  files: [] as ImportFileHandle[],

  newDatasetLabel: inferNewDatasetLabel(),
  targetAddDataset: undefined as PlId | undefined,

  gzipped: false,
  readIndices: ['R1'] as string[],
  pattern: '',

  fileDialogOpened: true,
  datasetDialogOpened: false,

  importing: false
});

watch(
  () => ({
    fileDialogOpened: data.fileDialogOpened,
    datasetDialogOpened: data.datasetDialogOpened
  }),
  ({ fileDialogOpened, datasetDialogOpened }) => {
    if (!fileDialogOpened && !datasetDialogOpened) doClose();
  }
);

type ImportMode = 'create-new-dataset' | 'add-to-existing';

function inferNewDatasetLabel() {
  let i = app.model.args.datasets.length + 1;
  while (i < 1000) {
    let label = 'My Dataset';
    if (i > 0) {
      label = label + ` (${i})`;
    }
    if (app.model.args.datasets.findIndex((d) => d.label === label) === -1) return label;
    ++i;
  }
  return 'New Dataset';
}

// Pattern compilation and file name matching
const patternError = ref<string | undefined>(undefined);
const compiledPattern = shallowRef<FileNamePattern | undefined>(undefined);

watch(
  () => data.pattern,
  (p) => {
    if (!p) {
      compiledPattern.value = undefined;
      patternError.value = undefined;
      return;
    }

    try {
      compiledPattern.value = FileNamePattern.parse(p);
      patternError.value = undefined;
    } catch (err: any) {
      compiledPattern.value = undefined;
      patternError.value = err.message;
    }
  },
  { immediate: true }
);

function addFiles(files: ImportFileHandle[]) {
  const fileNames = files.map((h) => extractFileName(getFilePathFromHandle(h)));
  if (data.files.length === 0) {
    const inferedPattern = inferFileNamePattern(fileNames);
    if (inferedPattern) {
      data.pattern = inferedPattern.pattern.rawPattern;
      data.gzipped = inferedPattern.extension.endsWith('.gz');
      data.readIndices = inferedPattern.readIndices;
    }
    // @todo add some meaningful notification if failed to infer pattern
  }
  data.files.push(...files);
}

function extractFileName(filePath: string) {
  return filePath.replace(/^.*[\\/]/, '');
}

const parsedFiles = computed<ParsedFile[]>(() =>
  data.files.map((handle) => {
    const fileName = extractFileName(getFilePathFromHandle(handle));
    const match = compiledPattern.value?.match(fileName);
    return {
      handle,
      fileName,
      match
    };
  })
);
const hasMatchedFiles = computed(() => parsedFiles.value.filter((f) => f.match).length > 0);

const readIndicesOptions: SimpleOption<string>[] = [
  {
    value: JSON.stringify(['R1']),
    text: 'R1'
  },
  {
    value: JSON.stringify(['R1', 'R2']),
    text: 'R1, R2'
  },
  {
    value: JSON.stringify([]),
    text: 'fasta'
  }
];

const modesOptions: SimpleOption<ImportMode>[] = [
  {
    value: 'create-new-dataset',
    text: 'Create new dataset'
  },
  {
    value: 'add-to-existing',
    text: 'Add to existing dataset'
  }
];

const addToExistingOptions = computed<SimpleOption<PlId>[]>(() => {
  const { gzipped, readIndices } = data;
  return app.model.args.datasets
    .filter(
      (ds) =>
        compiledPattern.value &&
        ds.content.type === (compiledPattern.value.hasLaneMatcher ? 'MultilaneFastq' : 'Fastq') &&
        ds.content.gzipped === gzipped &&
        JSON.stringify(ds.content.readIndices) === JSON.stringify(readIndices)
    )
    .map((ds) => ({
      value: ds.id,
      text: ds.label
    }));
});

watch(addToExistingOptions, (ops) => {
  if (ops.length === 0) data.targetAddDataset = undefined;
  else data.targetAddDataset = ops[0].value;
});

function createGetOrCreateSample(args: BlockArgs) {
  return (sampleName: string) => {
    const id = Object.entries(args.sampleLabels).find(([, label]) => label === sampleName)?.[0];
    if (id) return id as PlId;
    const newId = uniquePlId();
    args.sampleIds.push(newId);
    args.sampleLabels[newId] = sampleName;
    return newId;
  };
}

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
    if (dataset.content.type === 'Fasta') addFastaDatasetContent(args, dataset.content.data);
    if (dataset.content.type === 'Fastq') addFastqDatasetContent(args, dataset.content.data);
    else if (dataset.content.type === 'MultilaneFastq')
      addMultilaneFastqDatasetContent(args, dataset.content.data);
    else throw new Error('Unknonw dataset type');
  });
  app.navigateTo(`/dataset?id=${datasetId}`);
}

async function createNewDataset() {
  const newDatasetId = uniquePlId();
  await app.updateArgs((args) => {
    if (data.readIndices.length === 0 /* fasta */) {
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
    } else if (compiledPattern.value?.hasLaneMatcher) {
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
  app.navigateTo(`/dataset?id=${newDatasetId}`);
}

const canCreateOrAdd = computed(
  () =>
    hasMatchedFiles.value &&
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
      <PlBtnPrimary :disabled="!canCreateOrAdd" @click="
          {
        createOrAdd();
      }
        " :loading="data.importing">
        {{ data.mode === 'create-new-dataset' ? 'Create' : 'Add' }}
      </PlBtnPrimary>

      <PlBtnGhost @click.stop="() => doClose()">Cancel</PlBtnGhost>
    </template>
  </PlDialogModal>

  <PlFileDialog v-model="data.fileDialogOpened" :close-on-outside-click="false" :multi="true"
    title="Select files to import" @import:files="(e) => {
        addFiles(e.files);
        data.datasetDialogOpened = true;
      }
      " />
</template>
