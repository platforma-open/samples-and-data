<script setup lang="ts">
import { ListOption, PlBlockPage, PlBtnGhost, PlBtnGroup, PlBtnPrimary, PlBtnSecondary, PlCheckbox, PlContainer, PlTextField } from '@platforma-sdk/ui-vue';
import { useApp } from './app';
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { buildWrappedString, FileNameFormattingOpts, FileNamePattern, FileNamePatternMatch, getWellFormattedReadIndex, inferFileNamePattern } from './file_name_parser';
import { PlFileDialog } from '@platforma-sdk/ui-vue';
import { getFilePathFromHandle, ImportFileHandle } from '@platforma-sdk/model';
import { useCssModule } from 'vue'
import { DatasetContentFastq, PlId, ReadIndices, uniquePlId } from '@milaboratory/milaboratories.samples-and-data.model';

const app = useApp();

const data = reactive({
  datasetLabel: `Dataset (${app.args.datasets.length + 1})`,
  files: [] as ImportFileHandle[],
  gzipped: false,
  readIndices: ["R1"] as string[],
  pattern: "",
  fileDialogOpened: false,
  creating: false
});

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

function setFileList(files: ImportFileHandle[]) {
  const fileNames = files.map(h => extractFileName(getFilePathFromHandle(h)));
  const inferedPattern = inferFileNamePattern(fileNames);
  if (inferedPattern) {
    data.pattern = inferedPattern.pattern.rawPattern;
    data.gzipped = inferedPattern.extension === "fastq.gz";
    data.readIndices = inferedPattern.readIndices;
  }
  data.files = files;
}

function extractFileName(filePath: string) {
  return filePath.replace(/^.*[\\/]/, '');
}

type ParsedFile = {
  handle: ImportFileHandle,
  fileName: string,
  match?: FileNamePatternMatch
}

const parsedFiles = computed<ParsedFile[]>(() => data.files.map(handle => {
  const fileName = extractFileName(getFilePathFromHandle(handle));
  const match = compiledPattern.value?.match(fileName);
  return {
    handle, fileName, match
  }
}))
const hasMatchedFiles = computed(() => parsedFiles.value.filter(f => f.match).length > 0)
const formattedFilesHtml = computed(() => {
  const styles = useCssModule();
  const wrappingOps: FileNameFormattingOpts = {
    sample: { begin: `<span class="${styles['sampleName']}">`, end: "</span>" },
    readIndex: { begin: `<span class="${styles['readIndex']}">`, end: "</span>" },
    lane: { begin: `<span class="${styles['lane']}">`, end: "</span>" },
  }
  return parsedFiles.value.map((f) => {
    if (!f.match)
      return `<pre class="${styles['unmatched']}">${f.fileName}</pre>`
    else
      return "<pre>" + buildWrappedString(f.fileName, f.match, wrappingOps) + "</pre>"
  }).join("")
})

const readIndicesOptions: ListOption<string>[] = [{
  value: JSON.stringify(["R1"]),
  text: "R1"
}, {
  value: JSON.stringify(["R1", "R2"]),
  text: "R1, R2"
}]

async function create() {
  data.creating = true;
  const newDatasetId = uniquePlId();
  await app.updateArgs(args => {
    const getOrCreateSample = (sampleName: string) => {
      const id = Object.entries(args.sampleLabels).find(([, label]) => label === sampleName)?.[0]
      if (id)
        return id as PlId;
      const newId = uniquePlId();
      args.sampleIds.push(newId);
      args.sampleLabels[newId] = sampleName;
      return newId;
    }

    const contentData: DatasetContentFastq["data"] = {}

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

    args.datasets.push({
      label: data.datasetLabel,
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
    <template #title>Create New Dataset</template>
    <template #append>
      <PlBtnGhost :icon="'clear'" @click.stop="() => data.files = []">Clear</PlBtnGhost>
    </template>
    <PlContainer>
      <PlTextField label="Dataset Name" v-model="data.datasetLabel" />
      <PlContainer v-if='data.files.length > 0'>
        <PlTextField label="Pattern" v-model="data.pattern" :error="patternError" />
        <PlCheckbox v-model="data.gzipped">
          Gzipped
        </PlCheckbox>
        <PlBtnGroup :model-value="JSON.stringify(data.readIndices)"
          @update:model-value="v => data.readIndices = JSON.parse(v)" :options="readIndicesOptions" />
        <div :class="$style.fileList" v-html="formattedFilesHtml">
        </div>
        <PlBtnPrimary :style="{ marginBottom: '20px' }" :disabled="compiledPattern?.hasLaneMatcher || !hasMatchedFiles"
          @click="create()" :loading="data.creating">
          Create
        </PlBtnPrimary>
      </PlContainer>
      <PlBtnPrimary v-else @click="() => data.fileDialogOpened = true">Select Files
      </PlBtnPrimary>
    </PlContainer>
  </PlBlockPage>
  <PlFileDialog v-model="data.fileDialogOpened" :multi="true" @import:files="(e) => setFileList(e.files)" />
</template>

<style module>
.fileList {
  margin-top: 10px;
}

.fileList pre {
  margin-top: -3px;
}

.sampleName {
  background-color: #D0F0C0;
}

.readIndex {
  background-color: #FAF5AA;
}

.lane {
  background-color: #DEDBFF;
}

.unmatched {
  background-color: #E1E3EB;
}
</style>