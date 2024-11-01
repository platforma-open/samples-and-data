<script setup lang="ts">
import { computed, useCssModule } from 'vue';
import { buildWrappedString, FileNameFormattingOpts } from './file_name_parser';
import { ParsedFile } from './types';

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

const nFilesMatched = computed(() => {
  return props.items.filter((f) => f.match).length
});

const nFilesUnmatched = computed(() => {
  return props.items.filter((f) => !f.match).length
});

</script>

<template>
  <div :class="$style.container">
    <span :class="$style.matchText">{{ nFilesMatched }} file(s) matched <span :class="$style.unmatchedText">&nbsp;&nbsp;/&nbsp;&nbsp;{{ nFilesUnmatched }} file(s) not matched </span></span>

    <div :class="$style.fileList" class="pl-scrollable" v-html="formattedFilesHtml" />
  </div>
</template>

<style module>
.container {
  border-top: 1px solid var(--border-color-div-grey);
  max-height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.matchText {
  display: flex;
  height: 40px;
  padding: 12px 0px;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.unmatchedText {
  color: var(--dis-01)
}

.fileList {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
  gap: 0;
}

.fileList pre {
  line-height: 22px;
  margin-top: 0;
  margin-bottom: 0;
  font-family: var(--font-family-monospace);
}

.fileList pre span {
  line-height: inherit;
  min-height: 100%;
  display: inline-block;
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