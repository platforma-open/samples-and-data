<script setup lang="ts">
import { ICellRendererParams } from '@ag-grid-community/core';
import { ImportFileHandle } from '@platforma-sdk/model';
import { PlFileInput } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from './app';

const app = useApp();

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

const currentProgress = computed(() => {
  const progresses = app.progresses;

  if (!handle.value) return undefined;
  else return progresses[handle.value];
});
</script>

<template>
  <div :title="JSON.stringify(currentProgress)">
    <PlFileInput show-filename-only file-dialog-title="Select any file" :placeholder="`file.${extensions[0]}`" :extensions="extensions"
      :model-value="handle" @update:model-value="onHandleUpdate" clearable :progress="currentProgress" />
  </div>
</template>
