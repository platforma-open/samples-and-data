<script setup lang="ts">
import { ListOption, PlBlockPage, PlBtnGhost, PlBtnGroup, PlBtnPrimary, PlBtnSecondary, PlCheckbox, PlContainer, PlDropdown, PlRow, PlTextField, SimpleOption } from '@platforma-sdk/ui-vue';
import { useApp } from './app';
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { buildWrappedString, FileNameFormattingOpts, FileNamePattern, FileNamePatternMatch, getWellFormattedReadIndex, inferFileNamePattern } from './file_name_parser';
import { PlFileDialog } from '@platforma-sdk/ui-vue';
import { getFilePathFromHandle, ImportFileHandle } from '@platforma-sdk/model';
import { useCssModule } from 'vue'
import { BlockArgs, DatasetContentFastq, PlId, ReadIndices, uniquePlId } from '@platforma-open/milaboratories.samples-and-data.model';
import ParsedFilesList from './ParsedFilesList.vue';
import { whenever } from '@vueuse/core';
import { ParsedFile } from './types';

const app = useApp();

type ImprtMode = "create-new-dataset" | "add-to-existing";

function inferNewDatasetLabel() {
  let i = app.args.datasets.length + 1;
  while (i < 1000) {
    const label = `Dataset (${i})`;
    if (app.args.datasets.findIndex(d => d.label === label) === -1)
      return label;
    ++i;
  }
  return "New Dataset";
}

const data = reactive({
  mode: "create-new-dataset" as ImprtMode,
  files: [] as ImportFileHandle[],

  newDatasetLabel: inferNewDatasetLabel(),
  targetAddDataset: undefined as PlId | undefined,

  gzipped: false,
  readIndices: ["R1"] as string[],
  pattern: "",
  fileDialogOpened: false,
  importing: false
});

whenever(() => data.files.length === 0, () => data.fileDialogOpened = true, { immediate: true })

// Pattern compilation and file name matching
const patternError = ref<string | undefined>(undefined)
const compiledPattern = shallowRef<FileNamePattern | undefined>(undefined)

watch(() => data.pattern, p => {
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
}, { immediate: true })

function addFiles(files: ImportFileHandle[]) {
  const fileNames = files.map(h => extractFileName(getFilePathFromHandle(h)));
  if (data.files.length === 0) {
    const inferedPattern = inferFileNamePattern(fileNames);
    if (inferedPattern) {
      data.pattern = inferedPattern.pattern.rawPattern;
      data.gzipped = inferedPattern.extension === "fastq.gz";
      data.readIndices = inferedPattern.readIndices;
    }
    // @todo add some meaningful notification if failed to infer pattern
  }
  data.files.push(...files);
}

function extractFileName(filePath: string) {
  return filePath.replace(/^.*[\\/]/, '');
}

const parsedFiles = computed<ParsedFile[]>(() => data.files.map(handle => {
  const fileName = extractFileName(getFilePathFromHandle(handle));
  const match = compiledPattern.value?.match(fileName);
  return {
    handle, fileName, match
  }
}))
const hasMatchedFiles = computed(() => parsedFiles.value.filter(f => f.match).length > 0)

const readIndicesOptions: SimpleOption<string>[] = [{
  value: JSON.stringify(["R1"]),
  text: "R1"
}, {
  value: JSON.stringify(["R1", "R2"]),
  text: "R1, R2"
}]

const modesOptions: SimpleOption<ImprtMode>[] = [{
  value: 'add-to-existing',
  text: "Add to existing dataset"
}, {
  value: 'create-new-dataset',
  text: "Create new dataset"
}]

const addToExistingOptions = computed<SimpleOption<PlId>[]>(() => {
  const { gzipped, readIndices } = data;
  return app.model.args.datasets
    .filter(ds => ds.content.gzipped === gzipped && JSON.stringify(ds.content.readIndices) === JSON.stringify(readIndices))
    .map(ds => ({
      value: ds.id,
      text: ds.label
    }))
})

watch(addToExistingOptions, ops => {
  if (ops.length === 0)
    data.targetAddDataset = undefined;
  else
    data.targetAddDataset = ops[0].value;
})

function addDatasetContent(args: BlockArgs, contentData: DatasetContentFastq["data"]) {
  const getOrCreateSample = (sampleName: string) => {
    const id = Object.entries(args.sampleLabels).find(([, label]) => label === sampleName)?.[0]
    if (id)
      return id as PlId;
    const newId = uniquePlId();
    args.sampleIds.push(newId);
    args.sampleLabels[newId] = sampleName;
    return newId;
  }

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(sample)
    const readIndex = getWellFormattedReadIndex(f.match)
    let fileGroup = contentData[sampleId];
    if (!fileGroup) {
      fileGroup = {};
      contentData[sampleId] = fileGroup;
    }
    fileGroup[readIndex] = f.handle;
  }

  console.dir(contentData, { depth: 5 });
}

async function createOrAdd() {
  if (data.mode === 'add-to-existing')
    await addToExistingDataset();
  else
    await createNewDataset()
}

async function addToExistingDataset() {
  data.importing = true;
  const datasetId = data.targetAddDataset!;
  await app.updateArgs(args => {
    const dataset = args.datasets.find(ds => ds.id === datasetId);
    if (dataset === undefined) throw new Error("Dataset not found");
    addDatasetContent(args, dataset.content.data);
  })
  app.navigateTo(`/dataset?id=${datasetId}`)
}

async function createNewDataset() {
  data.importing = true;
  const newDatasetId = uniquePlId();
  await app.updateArgs(args => {
    const contentData: DatasetContentFastq["data"] = {}
    addDatasetContent(args, contentData);

    args.datasets.push({
      label: data.newDatasetLabel,
      id: newDatasetId,
      content: {
        type: 'Fastq',
        gzipped: data.gzipped,
        readIndices: ReadIndices.parse(data.readIndices),
        data: contentData
      }
    })
  })
  app.navigateTo(`/dataset?id=${newDatasetId}`)
}

</script>

<template>
  <PlBlockPage>
    <template #title>Import </template>
    <template #append>
      <PlBtnGhost :icon="'clear'" @click.stop="() => data.files = []">Clear</PlBtnGhost>
    </template>
    <PlContainer>
      <PlBtnPrimary @click="() => data.fileDialogOpened = true" v-if='data.files.length === 0'>Add files</PlBtnPrimary>
      <PlContainer v-if='data.files.length > 0'>
        <PlBtnGroup v-model="data.mode" :options="modesOptions" />

        <PlRow class="align-center">
          <PlTextField v-if="data.mode === 'create-new-dataset'" label="Dataset Name" v-model="data.newDatasetLabel"
            class="flex-grow-1" />
          <PlDropdown v-else v-model="data.targetAddDataset" :options="addToExistingOptions" class="flex-grow-1" />
          <PlBtnGroup :model-value="JSON.stringify(data.readIndices)" :style="{ width: '200px' }"
            @update:model-value="v => data.readIndices = JSON.parse(v)" :options="readIndicesOptions" />
          <PlCheckbox v-model="data.gzipped">
            Gzipped
          </PlCheckbox>
          <PlBtnPrimary :style="{ width: '100px' }" :disabled="compiledPattern?.hasLaneMatcher || !hasMatchedFiles"
            @click="createOrAdd()" :loading="data.importing">
            {{ data.mode === 'create-new-dataset' ? 'Create' : 'Add' }}
          </PlBtnPrimary>
        </PlRow>

        <PlTextField label="Pattern" v-model="data.pattern" :error="patternError" />
        <ParsedFilesList :items="parsedFiles" />
        <PlBtnSecondary @click="() => data.fileDialogOpened = true"> + add more files</PlBtnSecondary>
      </PlContainer>
    </PlContainer>
  </PlBlockPage>
  <PlFileDialog v-model="data.fileDialogOpened" :multi="true" :title="'Select files to import'"
    @import:files="(e) => addFiles(e.files)" />
</template>
