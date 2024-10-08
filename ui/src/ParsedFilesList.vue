<script setup lang="ts">
import { computed, useCssModule } from 'vue';
import { ParsedFile } from './types';
import { buildWrappedString, FileNameFormattingOpts } from './file_name_parser';

const props = defineProps<{ items: ParsedFile[] }>();

const formattedFilesHtml = computed(() => {
  const styles = useCssModule();
  const wrappingOps: FileNameFormattingOpts = {
    sample: { begin: `<span class="${styles['sampleName']}">`, end: "</span>" },
    readIndex: { begin: `<span class="${styles['readIndex']}">`, end: "</span>" },
    lane: { begin: `<span class="${styles['lane']}">`, end: "</span>" },
  }
  return props.items.map((f) => {
    if (!f.match)
      return `<pre class="${styles['unmatched']}">${f.fileName}</pre>`
    else
      return "<pre>" + buildWrappedString(f.fileName, f.match, wrappingOps) + "</pre>"
  }).join("")
})
</script>

<template>
  <div :class="$style.fileList" v-html="formattedFilesHtml" />
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