<script setup lang="ts">
import { PlChip } from '@platforma-sdk/ui-vue';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { computed } from 'vue';

const props = defineProps<{
  // this component is intended to be used in ag-grid, params are the main object
  // to communicate with the corresponding cell data
  params: ICellRendererParams & { datasets: string[] };
}>();

const datasets = computed(() => props.params.datasets);
</script>
<template>
  <div>
    <template v-for="ds in datasets">
      <PlChip :small="true" :style="{ marginLeft: '1px', marginRight: '1px' }">{{ ds }}</PlChip>
    </template>
  </div>
</template>
