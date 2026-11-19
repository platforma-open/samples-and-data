<script lang="ts" setup>
import { uniquePlId } from "@platforma-sdk/model";
import { PlBlockPage, PlLoaderCircular } from "@platforma-sdk/ui-vue";
import { onMounted } from "vue";
import { useApp } from "../app";

const app = useApp();

onMounted(async () => {
  const id = uniquePlId();
  try {
    await app.updateData((data) => ({
      ...data,
      designs: [...(data.designs ?? []), { id, label: "", materials: [] }],
    }));
    await app.allSettled();
    await app.navigateTo(`/design?id=${id}`);
  } catch {
    await app.navigateTo("/");
  }
});
</script>

<template>
  <PlBlockPage>
    <PlLoaderCircular />
  </PlBlockPage>
</template>
