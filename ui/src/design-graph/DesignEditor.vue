<script lang="ts" setup>
import { PlBtnGhost } from "@milaboratories/uikit";
import { computed, shallowRef, useCssModule } from "vue";
import DesignGraph from "./DesignGraph.vue";
import SelectionPanel from "./SelectionPanel.vue";
import { addStart } from "./edit";
import { withJunctions } from "./junctions";
import { toGraph } from "./toGraph";
import type { Design, Selection } from "./types";

const { initial } = defineProps<{ initial: Design }>();
const styles = useCssModule();

const design = shallowRef(initial);
const history = shallowRef<Design[]>([]);
const rawSelection = shallowRef<Selection>(null);

const graph = computed(() => withJunctions(toGraph(design.value)));
const selection = computed((): Selection => {
  const current = rawSelection.value;
  if (current?.kind === "edge") {
    const intoMaterial = graph.value.nodes.some(
      (node) => node.id === current.to && node.kind === "material",
    );
    const edge = graph.value.edges.find(
      (item) => item.id === current.id || (intoMaterial && item.to === current.to),
    );
    if (edge === undefined) {
      return null;
    }
    return { kind: "edge", id: edge.id, to: edge.to };
  }
  if (current === null || !graph.value.nodes.some((item) => item.id === current.id)) {
    return null;
  }
  return current;
});

function apply(next: Design, nextSelection?: Selection) {
  history.value = [...history.value, design.value];
  design.value = next;
  if (nextSelection !== undefined) rawSelection.value = nextSelection;
}

function undo() {
  design.value = history.value.at(-1)!;
  history.value = history.value.slice(0, -1);
}

function start() {
  const added = addStart(design.value);
  apply(added.design, { kind: "node", id: added.id });
}
</script>

<template>
  <div :class="styles.canvas">
    <DesignGraph :graph="graph" :selection="selection" @select="(next) => (rawSelection = next)">
      <template #toolbar>
        <PlBtnGhost icon="add" size="small" title="Add a starting material" @click="start">
          Start
        </PlBtnGhost>
        <PlBtnGhost
          icon="arrow-left-curved"
          size="small"
          title="Undo"
          :disabled="history.length === 0"
          @click="undo"
        />
      </template>
    </DesignGraph>
    <SelectionPanel
      v-if="selection !== null"
      :class="styles.panel"
      :design="design"
      :graph="graph"
      :selection="selection"
      @change="apply"
      @close="rawSelection = null"
    />
  </div>
</template>

<style module>
.canvas {
  position: relative;
  overflow: hidden;
  block-size: 100%;
  min-block-size: 320px;
  border: 1px solid var(--border-color-div-grey);
  border-radius: 6px;
  background: radial-gradient(var(--border-color-div-grey) 1px, transparent 1px) 0 0 / 16px 16px;
}

.panel {
  position: absolute;
  inset-inline: 8px;
  inset-block-end: 8px;
  max-block-size: 50%;
  overflow: auto;
}
</style>
