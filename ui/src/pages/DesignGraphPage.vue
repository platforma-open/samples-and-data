<script lang="ts" setup>
import type { ExperimentDesign } from "@platforma-open/milaboratories.samples-and-data.model";
import { designPlaceholder } from "@platforma-open/milaboratories.samples-and-data.model";
import {
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  PlBtnPrimary,
  PlBtnSecondary,
  PlDialogModal,
  PlEditableTitle,
  PlLoaderCircular,
} from "@platforma-sdk/ui-vue";
import { computed, shallowRef, useCssModule } from "vue";
import { useApp } from "../app";
import DesignEditor from "../design-graph/DesignEditor.vue";
import { withJunctions } from "../design-graph/junctions";
import { toGraph } from "../design-graph/toGraph";
import type { Design } from "../design-graph/types";
import { editorDesign, storedMaterials, tableSamples } from "../design_table";

const app = useApp();
const styles = useCssModule();
const designId = computed(() => app.queryParams.id);
const deleteOpen = shallowRef(false);
const deleting = shallowRef(false);

const designs = computed(() => app.model.data.designs ?? []);
const index = computed(() => designs.value.findIndex((design) => design.id === designId.value));
const current = computed(() => designs.value[index.value]);
const samples = computed(() => tableSamples(app.model.data));
const drawable = computed(() => {
  try {
    const design = editorDesign(current.value?.materials ?? [], samples.value);
    withJunctions(toGraph(design));
    return { design };
  } catch {
    return undefined;
  }
});

const updateCurrent = (change: (design: ExperimentDesign) => ExperimentDesign) =>
  app.updateData((data) => ({
    ...data,
    designs: (data.designs ?? []).map((design) =>
      design.id === designId.value ? change(design) : design,
    ),
  }));

const save = (next: Design) =>
  void updateCurrent((design) => ({ ...design, materials: storedMaterials(next) }));
const rename = (label: string) => void updateCurrent((design) => ({ ...design, label }));
const clear = () => void updateCurrent((design) => ({ ...design, materials: [] }));

async function deleteDesign() {
  deleteOpen.value = false;
  deleting.value = true;
  await app.updateData((data) => ({
    ...data,
    designs: (data.designs ?? []).filter((design) => design.id !== designId.value),
  }));
  await app.allSettled();
  await app.navigateTo("/");
}
</script>

<template>
  <PlBlockPage>
    <template #title>
      <PlEditableTitle
        v-if="current !== undefined"
        :model-value="current.label"
        :placeholder="designPlaceholder(index)"
        max-width="600px"
        :max-length="40"
        @update:model-value="rename"
      />
    </template>
    <template v-if="current !== undefined" #append>
      <PlBtnGhost icon="delete-bin" @click="deleteOpen = true">Delete design</PlBtnGhost>
    </template>
    <PlLoaderCircular v-if="deleting" />
    <PlAlert v-else-if="current === undefined" type="error">This design no longer exists.</PlAlert>
    <PlAlert v-else-if="drawable === undefined" type="error">
      The saved design cannot be drawn.
      <PlBtnSecondary size="small" @click="clear">Clear design</PlBtnSecondary>
    </PlAlert>
    <div v-else :class="styles.body">
      <DesignEditor :design="drawable.design" :samples="samples" @change="save" />
    </div>
  </PlBlockPage>

  <PlDialogModal v-model="deleteOpen">
    <template #title>Delete this design?</template>
    <template #actions>
      <PlBtnPrimary @click="deleteDesign">Delete</PlBtnPrimary>
      <PlBtnSecondary @click="deleteOpen = false">Cancel</PlBtnSecondary>
    </template>
  </PlDialogModal>
</template>

<style module>
.body {
  block-size: 100%;
}
</style>
