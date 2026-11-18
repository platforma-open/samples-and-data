<script lang="ts" setup>
import { PlBtnGhost } from "@milaboratories/uikit";
import { computed, shallowRef, useCssModule } from "vue";
import DesignGraph from "./DesignGraph.vue";
import SamplePicker from "./SamplePicker.vue";
import SelectionPanel from "./SelectionPanel.vue";
import type { DragSource, DropTarget, PortSide } from "./connect";
import { planDrop } from "./connect";
import { addChildSamples, addParentSamples, addStart } from "./edit";
import { mockSamples } from "./fixtures";
import { withJunctions } from "./junctions";
import { displayName } from "./layout";
import { toGraph } from "./toGraph";
import type { Design, Part, Sample, Selection } from "./types";

const { initial } = defineProps<{ initial: Design }>();
const styles = useCssModule();

const design = shallowRef(initial);
const history = shallowRef<Design[]>([]);
const rawSelection = shallowRef<Selection>(null);
const picker = shallowRef<{ nodeId: string; side: PortSide }>();
const lastPart = shallowRef<Part>("slice");
const samples = mockSamples(initial);
const SIDEBAR_WIDTH = 360;
const SIDEBAR_COVER = SIDEBAR_WIDTH + 8;

const graph = computed(() => withJunctions(toGraph(design.value)));
const placed = computed(() => new Set(design.value.materials.map((item) => item.id)));
const pickerTypesEdge = computed(
  () =>
    picker.value?.side === "out" ||
    design.value.materials.find((item) => item.id === picker.value?.nodeId)?.from === undefined,
);
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
const pickerTarget = computed(() => {
  const node = graph.value.nodes.find((item) => item.id === picker.value?.nodeId);
  if (node === undefined) {
    return undefined;
  }
  return displayName(node);
});

const sidebarOpen = computed(() => pickerTarget.value !== undefined || selection.value !== null);

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

function select(next: Selection) {
  picker.value = undefined;
  rawSelection.value = next;
}

function closeSidebar() {
  picker.value = undefined;
  rawSelection.value = null;
}

function openPicker(nodeId: string, side: PortSide) {
  rawSelection.value = { kind: "node", id: nodeId };
  picker.value = { nodeId, side };
}

const canDrop = (source: DragSource, target: DropTarget) =>
  planDrop(design.value, graph.value, source, target, lastPart.value) !== undefined;

function drop(source: DragSource, target: DropTarget) {
  const result = planDrop(design.value, graph.value, source, target, lastPart.value);
  if (result === undefined) {
    return;
  }
  if ("picker" in result) {
    openPicker(result.picker.nodeId, result.picker.side);
    return;
  }
  apply(result.design);
}

function addSamples(chosen: Sample[], part: Part) {
  const current = picker.value;
  if (current === undefined) {
    return;
  }
  lastPart.value = part;
  const next =
    current.side === "out"
      ? addChildSamples(design.value, current.nodeId, chosen, part)
      : addParentSamples(design.value, current.nodeId, chosen, part);
  if (next !== undefined) apply(next);
}
</script>

<template>
  <div :class="styles.canvas">
    <DesignGraph
      :graph="graph"
      :selection="selection"
      :can-drop="canDrop"
      :covered-right="sidebarOpen ? SIDEBAR_COVER : 0"
      @select="select"
      @port="openPicker"
      @drop="drop"
    >
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
    <aside v-if="sidebarOpen" :class="styles.sidebar">
      <SamplePicker
        v-if="picker !== undefined && pickerTarget !== undefined"
        :key="`${picker.nodeId}:${picker.side}`"
        :samples="samples"
        :placed="placed"
        :target="pickerTarget"
        :side="picker.side"
        :part="lastPart"
        :show-connection="pickerTypesEdge"
        @add="addSamples"
        @close="closeSidebar"
      />
      <SelectionPanel
        v-else-if="selection !== null"
        :design="design"
        :graph="graph"
        :selection="selection"
        @change="apply"
        @close="rawSelection = null"
      />
    </aside>
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

.sidebar {
  position: absolute;
  inset-block: 56px 8px;
  inset-inline-end: 8px;
  inline-size: calc(v-bind(SIDEBAR_WIDTH) * 1px);
  padding: 12px 16px 16px;
  overflow: auto;
  border: 1px solid var(--border-color-div-grey);
  border-radius: 6px;
  background: var(--bg-elevated-01);
}
</style>
