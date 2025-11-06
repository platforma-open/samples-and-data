<script setup lang="ts">
import { PlBtnPrimary, PlDialogModal } from '@platforma-sdk/ui-vue';

const props = defineProps<{
  errorMessage?: { title: string; message?: string };
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <PlDialogModal
    :model-value="errorMessage !== undefined"
    closable
    @update:model-value="
      (v) => {
        if (!v) emit('close');
      }
    "
  >
    <div>{{ errorMessage?.title }}</div>
    <pre v-if="errorMessage?.message">{{ errorMessage?.message }}</pre>
    <template #actions>
      <PlBtnPrimary @click="emit('close')">Ok</PlBtnPrimary>
    </template>
  </PlDialogModal>
</template>

