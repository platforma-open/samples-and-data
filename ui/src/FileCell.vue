<script setup lang="ts">
import { ICellRendererParams } from '@ag-grid-community/core';
import { ImportFileHandle } from '@milaboratory/sdk-ui';
import { FileInput } from '@milaboratory/sdk-vue';
import { computed } from 'vue';
import { injectProgresses } from './injects';

const props = defineProps<{
  // this component is intended to be used in ag-grid, params are the main object
  // to communicate with the corresponding cell data
  params: ICellRendererParams & { extensions: string[] };
}>();

const extensions = computed(() => props.params.extensions)

// extracting cell value and casting it to the type we expect
const handle = computed(() => props.params.value as ImportFileHandle | undefined);
/**
 * When value changes in the file input this method forward the value to the ag-grid,
 * which in tern forwards in to the valueSetter in corresponding column.
 * */
function onHandleUpdate(newHandle: ImportFileHandle | undefined) {
  props.params.setValue!(newHandle);
}

// @todo progress: to be passed to the file input to reflect upload status
const progresses = injectProgresses();
const currentProgress = computed(() => {
  if (!handle.value) return undefined;
  else return progresses.value[handle.value];
});
</script>

<template>
  <div>
    <FileInput file-dialog-title="Select any file" :placeholder="`file.${extensions[0]}`" :extensions="extensions"
      :model-value="handle" @update:model-value="onHandleUpdate" clearable />
  </div>
</template>
