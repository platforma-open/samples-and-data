<script lang="ts" setup>
import type { PlId } from "@platforma-open/milaboratories.samples-and-data.model";
import { PlDropdownMulti } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "../app";

/** Which datasets the open design applies to. Shown only when there is more than one to pick. */
const app = useApp();
const designId = computed(() => app.queryParams.id);
const design = computed(() => app.model.data.designs?.find((item) => item.id === designId.value));
const options = computed(() =>
  app.model.data.datasets.map((dataset) => ({ value: dataset.id, label: dataset.label })),
);
const picked = computed(() => design.value?.datasetIds ?? []);

const pick = (datasetIds: PlId[]) =>
  void app.updateData((data) => ({
    ...data,
    designs: (data.designs ?? []).map((item) =>
      item.id === designId.value ? { ...item, datasetIds } : item,
    ),
  }));
</script>

<template>
  <PlDropdownMulti
    v-if="design !== undefined && options.length > 1"
    :model-value="picked"
    :options="options"
    label="Datasets"
    placeholder="All datasets"
    @update:model-value="pick"
  />
</template>
