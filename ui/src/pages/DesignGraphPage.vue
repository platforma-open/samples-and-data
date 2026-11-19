<script lang="ts" setup>
import { PlAlert, PlBlockPage, PlBtnSecondary } from "@platforma-sdk/ui-vue";
import { computed, useCssModule } from "vue";
import { useApp } from "../app";
import DesignEditor from "../design-graph/DesignEditor.vue";
import { withJunctions } from "../design-graph/junctions";
import { toGraph } from "../design-graph/toGraph";
import type { Design } from "../design-graph/types";
import { editorDesign, storedDesign, tableSamples } from "../design_table";

const app = useApp();
const styles = useCssModule();
const samples = computed(() => tableSamples(app.model.data));
const drawable = computed(() => {
  try {
    const design = editorDesign(app.model.data.design, samples.value);
    withJunctions(toGraph(design));
    return { design };
  } catch {
    return undefined;
  }
});

const save = (next: Design) =>
  void app.updateData((data) => ({ ...data, design: storedDesign(next) }));

const clear = () => void app.updateData(({ design: _design, ...data }) => data);
</script>

<template>
  <PlBlockPage>
    <template #title>Design</template>
    <PlAlert v-if="drawable === undefined" type="error">
      The saved design cannot be drawn.
      <PlBtnSecondary size="small" @click="clear">Clear design</PlBtnSecondary>
    </PlAlert>
    <div v-else :class="styles.body">
      <DesignEditor :design="drawable.design" :samples="samples" @change="save" />
    </div>
  </PlBlockPage>
</template>

<style module>
.body {
  block-size: 100%;
}
</style>
