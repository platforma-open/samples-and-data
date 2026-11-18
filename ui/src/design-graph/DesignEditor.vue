<script lang="ts" setup>
import { PlBtnGhost, PlBtnGroup } from "@milaboratories/uikit";
import { computed, shallowRef, useCssModule } from "vue";
import DesignGraph from "./DesignGraph.vue";
import SamplePicker from "./SamplePicker.vue";
import SelectionPanel from "./SelectionPanel.vue";
import type { DragSource, DropTarget, PortSide } from "./connect";
import { planDrop } from "./connect";
import {
  addChildSamples,
  addParentSamples,
  addStart,
  addStepsTo,
  makeSplit,
  mergeInto,
  moveUnder,
  setPartOf,
} from "./edit";
import { mockSamples } from "./fixtures";
import { withJunctions } from "./junctions";
import { displayName, partOptions } from "./layout";
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

const rawMarked = shallowRef<Set<string>>(new Set());
const rawPickingParent = shallowRef(false);
const marked = computed(() => rawMarked.value.intersection(placed.value));
const markedIds = computed(() => Array.from(marked.value));
const pickingParent = computed(() => rawPickingParent.value && markedIds.value.length >= 2);
const canMakeSplit = computed(() => makeSplit(design.value, markedIds.value) !== undefined);
const commonPart = computed(() => {
  const parts = new Set(
    design.value.materials
      .filter((item) => marked.value.has(item.id))
      .map((item) => item.from?.part),
  );
  const [only] = parts;
  if (parts.size !== 1 || only === undefined) {
    return undefined;
  }
  return only;
});

function clearMarked() {
  rawMarked.value = new Set();
  rawPickingParent.value = false;
}

function mark(candidates: Set<string>) {
  const ids = candidates.intersection(placed.value);
  if (ids.size >= 2) {
    rawMarked.value = ids;
    rawPickingParent.value = false;
    rawSelection.value = null;
    picker.value = undefined;
    return;
  }
  clearMarked();
  const [only] = ids;
  rawSelection.value = only === undefined ? null : { kind: "node", id: only };
}

function toggle(nodeId: string) {
  const current = selection.value;
  const base =
    marked.value.size === 0 && current?.kind === "node" && placed.value.has(current.id)
      ? new Set([current.id])
      : marked.value;
  mark(base.has(nodeId) ? base.difference(new Set([nodeId])) : base.union(new Set([nodeId])));
}

function addSteps() {
  apply(addStepsTo(design.value, markedIds.value));
}

function setMarkedPart(part: Part) {
  lastPart.value = part;
  const next = setPartOf(design.value, markedIds.value, part);
  if (JSON.stringify(next) !== JSON.stringify(design.value)) apply(next);
}

function mergeMarked() {
  const merged = mergeInto(design.value, markedIds.value, lastPart.value);
  if (merged === undefined) {
    return;
  }
  clearMarked();
  apply(merged.design, { kind: "node", id: merged.id });
}

function makeMarkedSplit() {
  const next = makeSplit(design.value, markedIds.value);
  if (next !== undefined) apply(next);
}

function moveMarkedUnder(parentId: string) {
  const next = moveUnder(design.value, markedIds.value, parentId);
  if (next === undefined) {
    return;
  }
  rawPickingParent.value = false;
  apply(next);
}

function apply(next: Design, nextSelection?: Selection) {
  history.value = [...history.value, design.value];
  design.value = next;
  if (nextSelection !== undefined) rawSelection.value = nextSelection;
}

function undo() {
  clearMarked();
  design.value = history.value.at(-1)!;
  history.value = history.value.slice(0, -1);
}

function start() {
  const added = addStart(design.value);
  apply(added.design, { kind: "node", id: added.id });
}

function select(next: Selection) {
  if (pickingParent.value) {
    if (next?.kind === "node") moveMarkedUnder(next.id);
    return;
  }
  clearMarked();
  picker.value = undefined;
  rawSelection.value = next;
}

function closeSidebar() {
  picker.value = undefined;
  rawSelection.value = null;
}

function openPicker(nodeId: string, side: PortSide) {
  clearMarked();
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
      :marked="marked"
      @select="select"
      @toggle="toggle"
      @box="(nodeIds) => mark(new Set(nodeIds))"
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
    <div v-if="markedIds.length >= 2" :class="styles.bar">
      <template v-if="pickingParent">
        <span>Click the new parent</span>
        <PlBtnGhost size="small" @click="rawPickingParent = false">Cancel</PlBtnGhost>
      </template>
      <template v-else>
        <span :class="styles.count">{{ markedIds.length }} selected</span>
        <span :class="styles.label">Connection</span>
        <PlBtnGroup
          compact
          :options="partOptions"
          :model-value="commonPart"
          @update:model-value="setMarkedPart"
        />
        <PlBtnGhost icon="add" size="small" @click="addSteps">Add step to each</PlBtnGhost>
        <PlBtnGhost size="small" @click="mergeMarked">Merge</PlBtnGhost>
        <PlBtnGhost size="small" :disabled="!canMakeSplit" @click="makeMarkedSplit">
          Make one split
        </PlBtnGhost>
        <PlBtnGhost size="small" @click="rawPickingParent = true">Move under…</PlBtnGhost>
        <PlBtnGhost icon="close" size="small" title="Clear selection" @click="clearMarked" />
      </template>
    </div>
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

.bar {
  position: absolute;
  inset-block-end: 16px;
  inset-inline-start: 50%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--border-color-div-grey);
  border-radius: 6px;
  background: var(--bg-elevated-01);
  translate: -50% 0;
  white-space: nowrap;
}

.count {
  font-weight: 600;
}

.label {
  color: var(--txt-03);
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
