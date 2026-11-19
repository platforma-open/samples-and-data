<script lang="ts" setup>
import { PlBtnGhost, PlBtnGroup } from "@milaboratories/uikit";
import { computed, nextTick, shallowRef, useCssModule, useTemplateRef } from "vue";
import DesignGraph from "./DesignGraph.vue";
import SamplePicker from "./SamplePicker.vue";
import SelectionPanel from "./SelectionPanel.vue";
import type { DragSource, DropTarget, PortSide } from "./connect";
import { planDrop } from "./connect";
import {
  addChildSamples,
  addParentSamples,
  addStart,
  addStartSamples,
  addStepsTo,
  deleteMaterial,
  findMaterial,
  makeSplit,
  mergeInto,
  moveUnder,
  removeNode,
  replaceWithSample,
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
type Picker = { mode: "children" | "parents" | "replace"; nodeId: string } | { mode: "start" };
const picker = shallowRef<Picker>();
const lastPart = shallowRef<Part>("slice");
const samples = mockSamples(initial);
const SIDEBAR_WIDTH = 360;
const SIDEBAR_COVER = SIDEBAR_WIDTH + 8;

const graph = computed(() => withJunctions(toGraph(design.value)));
const placed = computed(() => new Set(design.value.materials.map((item) => item.id)));
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
type PickerView = {
  key: string;
  title: string;
  target?: string;
  mode: "add" | "replace";
  showConnection: boolean;
};
const pickerView = computed((): PickerView | undefined => {
  const current = picker.value;
  if (current?.mode === "start") {
    return { key: "start", title: "Add starting samples", mode: "add", showConnection: false };
  }
  const node = graph.value.nodes.find((item) => item.id === current?.nodeId);
  if (current === undefined || node === undefined) {
    return undefined;
  }
  const base = { key: `${current.mode}:${current.nodeId}`, target: displayName(node) };
  if (current.mode === "replace") {
    return { ...base, title: "Replace", mode: "replace", showConnection: false };
  }
  return {
    ...base,
    title: current.mode === "children" ? "Add children to" : "Add parents to",
    mode: "add",
    showConnection:
      current.mode === "children" || findMaterial(design.value, current.nodeId)?.from === undefined,
  };
});

const rawMarked = shallowRef<Set<string>>(new Set());
const rawPickingParent = shallowRef(false);
const marked = computed(() => rawMarked.value.intersection(placed.value));
const markedIds = computed(() => Array.from(marked.value));
const multiSelected = computed(() => markedIds.value.length >= 2);
const sidebarOpen = computed(
  () => multiSelected.value || pickerView.value !== undefined || selection.value !== null,
);
const pickingParent = computed(() => rawPickingParent.value && multiSelected.value);
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

function addShadowStart() {
  const added = addStart(design.value);
  picker.value = undefined;
  apply(added.design, { kind: "node", id: added.id });
}

function deleteSelected() {
  if (multiSelected.value) {
    const next = markedIds.value.reduce(deleteMaterial, design.value);
    clearMarked();
    apply(next);
    return;
  }
  const current = selection.value;
  if (current?.kind !== "node") {
    return;
  }
  const next = removeNode(design.value, graph.value, current.id);
  if (next === undefined) {
    return;
  }
  picker.value = undefined;
  apply(next, null);
}

const canvas = useTemplateRef("canvas");
const sidebar = useTemplateRef("sidebar");

function refocus() {
  void nextTick(() => {
    if (document.activeElement === null || document.activeElement === document.body) {
      canvas.value?.focus({ preventScroll: true });
    }
  });
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target;
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    !(target instanceof HTMLElement)
  ) {
    return;
  }
  if (event.key === "Escape") {
    if (
      target.isContentEditable ||
      target.matches("textarea, input:not([type='radio'], [type='checkbox'])")
    ) {
      return;
    }
    if (pickingParent.value) {
      rawPickingParent.value = false;
      return;
    }
    clearMarked();
    closeSidebar();
    return;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && !sidebar.value?.contains(target)) {
    event.preventDefault();
    deleteSelected();
  }
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

function openPicker(next: Picker) {
  clearMarked();
  rawSelection.value = next.mode === "start" ? null : { kind: "node", id: next.nodeId };
  picker.value = next;
}

const openPortPicker = (nodeId: string, side: PortSide) =>
  openPicker({ mode: side === "out" ? "children" : "parents", nodeId });

const canDrop = (source: DragSource, target: DropTarget) =>
  planDrop(design.value, graph.value, source, target, lastPart.value) !== undefined;

function drop(source: DragSource, target: DropTarget) {
  const result = planDrop(design.value, graph.value, source, target, lastPart.value);
  if (result === undefined) {
    return;
  }
  if ("picker" in result) {
    openPortPicker(result.picker.nodeId, result.picker.side);
    return;
  }
  apply(result.design);
}

function pickedDesign(current: Picker, chosen: Sample[], part: Part) {
  if (current.mode === "start") {
    return addStartSamples(design.value, chosen);
  }
  if (current.mode === "children") {
    return addChildSamples(design.value, current.nodeId, chosen, part);
  }
  if (current.mode === "parents") {
    return addParentSamples(design.value, current.nodeId, chosen, part);
  }
  const [sample] = chosen;
  if (sample === undefined) {
    return undefined;
  }
  return replaceWithSample(design.value, current.nodeId, sample);
}

function addSamples(chosen: Sample[], part: Part) {
  const current = picker.value;
  if (current === undefined) {
    return;
  }
  const next = pickedDesign(current, chosen, part);
  if (next === undefined) {
    return;
  }
  lastPart.value = part;
  if (current.mode !== "replace") {
    apply(next);
    return;
  }
  picker.value = undefined;
  apply(next, { kind: "node", id: chosen[0].id });
}
</script>

<template>
  <div ref="canvas" :class="styles.canvas" tabindex="-1" @keydown="onKeydown" @click="refocus">
    <DesignGraph
      :graph="graph"
      :selection="selection"
      :can-drop="canDrop"
      :covered-right="sidebarOpen ? SIDEBAR_COVER : 0"
      :marked="marked"
      @select="select"
      @toggle="toggle"
      @box="(nodeIds) => mark(new Set(nodeIds))"
      @port="openPortPicker"
      @drop="drop"
    >
      <template #toolbar>
        <PlBtnGhost
          icon="add"
          size="small"
          title="Add a starting material"
          @click="openPicker({ mode: 'start' })"
        >
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
    <aside v-if="sidebarOpen" ref="sidebar" :class="styles.sidebar">
      <section v-if="multiSelected" :class="styles.multi">
        <div :class="styles.corner">
          <PlBtnGhost icon="delete-bin" size="small" title="Delete" @click="deleteSelected" />
          <PlBtnGhost icon="close" size="small" title="Close" @click="clearMarked" />
        </div>
        <header :class="styles.header">
          <span :class="styles.count">{{ markedIds.length }} selected</span>
          <PlBtnGhost icon="add" size="small" @click="addSteps">Add step to each</PlBtnGhost>
          <PlBtnGhost size="small" @click="mergeMarked">Merge</PlBtnGhost>
          <PlBtnGhost size="small" :disabled="!canMakeSplit" @click="makeMarkedSplit">
            Make one split
          </PlBtnGhost>
          <PlBtnGhost v-if="pickingParent" size="small" @click="rawPickingParent = false">
            Cancel
          </PlBtnGhost>
          <PlBtnGhost v-else size="small" @click="rawPickingParent = true">Move under…</PlBtnGhost>
        </header>
        <p v-if="pickingParent" :class="styles.note">Click the new parent.</p>
        <PlBtnGroup
          v-else
          label="Connection"
          :options="partOptions"
          :model-value="commonPart"
          @update:model-value="setMarkedPart"
        />
      </section>
      <SamplePicker
        v-else-if="pickerView !== undefined"
        :key="pickerView.key"
        :samples="samples"
        :placed="placed"
        :title="pickerView.title"
        :target="pickerView.target"
        :mode="pickerView.mode"
        :part="lastPart"
        :show-connection="pickerView.showConnection"
        @add="addSamples"
        @close="closeSidebar"
      >
        <PlBtnGhost v-if="picker?.mode === 'start'" icon="add" size="small" @click="addShadowStart">
          Add shadow node
        </PlBtnGhost>
      </SamplePicker>
      <SelectionPanel
        v-else-if="selection !== null"
        :design="design"
        :graph="graph"
        :selection="selection"
        @change="apply"
        @delete="deleteSelected"
        @replace="(nodeId) => openPicker({ mode: 'replace', nodeId })"
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
  outline: none;
  background: radial-gradient(var(--border-color-div-grey) 1px, transparent 1px) 0 0 / 16px 16px;
}

.multi {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.corner {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  display: flex;
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding-inline-end: 64px;
}

.count {
  font-weight: 600;
}

.note {
  margin: 0;
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
