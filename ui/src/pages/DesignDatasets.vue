<script lang="ts" setup>
import type { PlId } from "@platforma-open/milaboratories.samples-and-data.model";
import { PlDropdown } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "../app";

/** Which dataset the open design applies to. Shown only when there is more than one to pick.
 *  One dataset and not several: a design reaching across two of them cannot be analysed, since
 *  each is clonotyped on its own. Picking nothing means the first, as `designScope` reads it. */
const app = useApp();
const designId = computed(() => app.queryParams.id);
const design = computed(() => app.model.data.designs?.find((item) => item.id === designId.value));
const options = computed(() =>
  app.model.data.datasets.map((dataset) => ({ value: dataset.id, label: dataset.label })),
);
/** The design's own pick, else the dataset `designScope` falls back to, so the field never reads
 *  empty while the design is in fact scoped. */
const picked = computed(() => design.value?.datasetIds?.[0] ?? app.model.data.datasets[0]?.id);

const pick = (datasetId?: PlId) =>
  void app.updateData((data) => ({
    ...data,
    designs: (data.designs ?? []).map((item) =>
      item.id === designId.value ? { ...item, datasetIds: datasetId ? [datasetId] : [] } : item,
    ),
  }));
</script>

<template>
  <PlDropdown
    v-if="design !== undefined && options.length > 1"
    :model-value="picked"
    :options="options"
    label="Dataset"
    required
    @update:model-value="pick"
  />
</template>
