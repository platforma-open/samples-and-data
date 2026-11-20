<script lang="ts" setup>
import { PlBtnGhost, PlBtnGroup, PlBtnPrimary, PlSlideModal } from "@milaboratories/uikit";
import { computed, nextTick, shallowRef, useCssModule, useTemplateRef, watch } from "vue";
import DesignGraph from "./DesignGraph.vue";
import SamplePicker from "./SamplePicker.vue";
import SelectionPanel from "./SelectionPanel.vue";
import type { DragSource, DropTarget, PortSide } from "./connect";
import { logicalEdge, planDrop } from "./connect";
import {
  addChildSamples,
  addMergedChildren,
  addParentSamples,
  addStart,
  addStartSamples,
  canJoin,
  deleteMaterial,
  disconnect,
  findMaterial,
  insertParent,
  joinGroups,
  makeSplit,
  mergeInto,
  moveUnder,
  removeNode,
  replaceWithSample,
  setPartOf,
} from "./edit";
import { junctionOf, withJunctions } from "./junctions";
import { displayName, labelIn, nodeIn, partOptions } from "./layout";
import { parentsOf, toGraph } from "./toGraph";
import type { Design, Part, Sample, Selection } from "./types";

const props = defineProps<{ design: Design; samples: Sample[]; highlight?: Set<string> }>();
const emit = defineEmits<{ change: [design: Design] }>();
const styles = useCssModule();

const history = shallowRef<Design[]>([]);
const rawSelection = shallowRef<Selection>(null);
type Picker =
  | { mode: "children" | "parents" | "replace"; nodeId: string }
  | { mode: "start" }
  | { mode: "merged-children"; parentIds: string[] };
const picker = shallowRef<Picker>();
const lastPart = shallowRef<Part>("slice");
const SIDEBAR_WIDTH = 368;
const CANVAS_TOOLBAR_HEIGHT = 56;

const graph = computed(() => withJunctions(toGraph(props.design)));
const placed = computed(() => new Set(props.design.materials.map((item) => item.id)));
const selection = computed((): Selection => {
  const current = rawSelection.value;
  if (current?.kind === "edge") {
    const intoMaterial = graph.value.nodes.some(
      (node) => node.id === current.to && node.kind === "material",
    );
    const edge =
      graph.value.edges.find((item) => item.id === current.id) ??
      graph.value.edges.find((item) => intoMaterial && item.to === current.to);
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
  mode: "add" | "replace";
  showConnection: boolean;
};
const pickerView = computed((): PickerView | undefined => {
  const current = picker.value;
  if (current?.mode === "start") {
    return { key: "start", title: "Add starting samples", mode: "add", showConnection: false };
  }
  if (current?.mode === "merged-children") {
    const parents = current.parentIds
      .map((id) => graph.value.nodes.find((item) => item.id === id))
      .filter((item) => item !== undefined);
    if (parents.length !== current.parentIds.length) {
      return undefined;
    }
    return {
      key: "merged-children",
      title: `Add children to a merge of ${parents.map(displayName).join(", ")}`,
      mode: "add",
      showConnection: true,
    };
  }
  const node = graph.value.nodes.find((item) => item.id === current?.nodeId);
  if (current === undefined || node === undefined) {
    return undefined;
  }
  const key = `${current.mode}:${current.nodeId}`;
  if (current.mode === "replace") {
    return { key, title: `Replace ${displayName(node)}`, mode: "replace", showConnection: false };
  }
  return {
    key,
    title: `${current.mode === "children" ? "Add children to" : "Add parents to"} ${displayName(node)}`,
    mode: "add",
    showConnection:
      current.mode === "children" || findMaterial(props.design, current.nodeId)?.from === undefined,
  };
});

const rawMarked = shallowRef<Set<string>>(new Set());
const rawPickMode = shallowRef<"move" | "connect">();
const marked = computed(() => rawMarked.value.intersection(placed.value));
const markedIds = computed(() => Array.from(marked.value));
const multiSelected = computed(() => markedIds.value.length >= 2);
const sidebarOpen = computed(
  () => multiSelected.value || pickerView.value !== undefined || selection.value !== null,
);
const pickingParent = computed(() => rawPickMode.value === "move" && multiSelected.value);
const connectTargets = shallowRef<Set<string>>(new Set());
const connecting = computed(() => rawPickMode.value === "connect" && multiSelected.value);
const shownTargets = computed(() => (connecting.value ? connectTargets.value : new Set<string>()));
const picking = computed(() => pickingParent.value || connecting.value);
const labelOf = (id: string) => labelIn(graph.value, id);
const childOf = (id: string) => graph.value.edges.find((edge) => edge.from === id)?.to ?? "";
const kindOf = (id: string) => nodeIn(graph.value, id)?.kind;
const isTextEntry = (target: HTMLElement) =>
  target.isContentEditable ||
  target.matches("textarea, input:not([type='radio'], [type='checkbox'])");

function selectionTitle(current: NonNullable<Selection>) {
  if (current.kind === "edge") {
    const edge = graph.value.edges.find((item) => item.id === current.id);
    if (edge !== undefined && kindOf(current.to) === "pool") {
      return `${labelOf(edge.from)} → ${labelOf(childOf(current.to))}`;
    }
    const from = findMaterial(props.design, current.to)?.from;
    if (from === undefined) {
      return labelOf(current.to);
    }
    return `${parentsOf(from).map(labelOf).join(" + ")} → ${labelOf(current.to)}`;
  }
  const kind = kindOf(current.id);
  if (kind === "junction") {
    return `Split of ${labelOf(junctionOf(graph.value, current.id)?.parentId ?? "")}`;
  }
  if (kind === "pool") {
    return `Merge into ${labelOf(childOf(current.id))}`;
  }
  const material = findMaterial(props.design, current.id);
  if (material !== undefined && !material.sequenced) {
    return material.from === undefined ? "Starting material" : "Step";
  }
  return labelOf(current.id);
}

const sidebarTitle = computed(() => {
  if (multiSelected.value) {
    return `${markedIds.value.length} selected`;
  }
  if (pickerView.value !== undefined) {
    return pickerView.value.title;
  }
  if (selection.value === null) {
    return "";
  }
  return selectionTitle(selection.value);
});

function dismiss() {
  clearMarked();
  closeSidebar();
}

function guardEscape(event: KeyboardEvent) {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (isTextEntry(target) || target.closest(".pl-dropdown, .pl-dropdown-multi") !== null)
  ) {
    event.stopPropagation();
  }
}
const canMakeSplit = computed(() => makeSplit(props.design, markedIds.value) !== undefined);
const commonPart = computed(() => {
  const parts = new Set(
    props.design.materials
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
  setPickMode();
}

function setPickMode(mode?: "move" | "connect") {
  rawPickMode.value = mode;
  connectTargets.value = new Set();
}

const canTarget = (id: string) => canJoin(props.design, markedIds.value, [id]);

function pickTargets(ids: string[]) {
  const allowed = new Set(ids.filter(canTarget));
  const current = connectTargets.value;
  connectTargets.value = allowed.isSubsetOf(current)
    ? current.difference(allowed)
    : current.union(allowed);
}

function applyNew(result?: { design: Design; id: string }) {
  if (result === undefined) {
    return;
  }
  clearMarked();
  apply(result.design, { kind: "node", id: result.id });
}

const join = (parents: string[], children: string[]) =>
  applyNew(joinGroups(props.design, parents, children, lastPart.value));
const connectMarked = () => join(markedIds.value, Array.from(connectTargets.value));
const insertMarkedStep = () => applyNew(insertParent(props.design, markedIds.value));
const canInsertStep = computed(() => insertParent(props.design, markedIds.value) !== undefined);

function mark(candidates: Set<string>) {
  if (connecting.value) {
    pickTargets(Array.from(candidates));
    return;
  }
  const ids = candidates.intersection(placed.value);
  if (ids.size >= 2) {
    rawMarked.value = ids;
    setPickMode();
    rawSelection.value = null;
    picker.value = undefined;
    return;
  }
  clearMarked();
  const [only] = ids;
  rawSelection.value = only === undefined ? null : { kind: "node", id: only };
}

function toggle(nodeId: string) {
  if (connecting.value) {
    pickTargets([nodeId]);
    return;
  }
  const current = selection.value;
  const base =
    marked.value.size === 0 && current?.kind === "node" && placed.value.has(current.id)
      ? new Set([current.id])
      : marked.value;
  mark(base.has(nodeId) ? base.difference(new Set([nodeId])) : base.union(new Set([nodeId])));
}

const addMarkedChildren = () => openPicker({ mode: "merged-children", parentIds: markedIds.value });

function setMarkedPart(part: Part) {
  lastPart.value = part;
  const next = setPartOf(props.design, markedIds.value, part);
  if (JSON.stringify(next) !== JSON.stringify(props.design)) apply(next);
}

const mergeMarked = () => applyNew(mergeInto(props.design, markedIds.value));

function makeMarkedSplit() {
  const next = makeSplit(props.design, markedIds.value);
  if (next !== undefined) apply(next);
}

function moveMarkedUnder(parentId: string) {
  const next = moveUnder(props.design, markedIds.value, parentId);
  if (next === undefined) {
    return;
  }
  setPickMode();
  apply(next);
}

function apply(next: Design, nextSelection?: Selection) {
  history.value = [...history.value, props.design];
  emit("change", next);
  if (nextSelection !== undefined) rawSelection.value = nextSelection;
}

function undo() {
  clearMarked();
  emit("change", history.value.at(-1)!);
  history.value = history.value.slice(0, -1);
}

function addShadowStart() {
  const added = addStart(props.design);
  picker.value = undefined;
  apply(added.design, { kind: "node", id: added.id });
}

function removed(current: NonNullable<Selection>) {
  if (current.kind === "node") {
    return removeNode(props.design, graph.value, current.id);
  }
  const ends = logicalEdge(graph.value, current.id);
  if (ends === undefined) {
    return undefined;
  }
  return disconnect(props.design, ends.parentId, ends.childId);
}

function deleteSelected() {
  if (multiSelected.value) {
    const next = markedIds.value.reduce(deleteMaterial, props.design);
    clearMarked();
    apply(next);
    return;
  }
  const current = selection.value;
  if (current === null) {
    return;
  }
  const next = removed(current);
  if (next === undefined) {
    return;
  }
  picker.value = undefined;
  apply(next, null);
}

const canvas = useTemplateRef("canvas");

function refocus() {
  void nextTick(() => {
    const active = document.activeElement;
    if (active === null || active === document.body || !sidebarOpen.value) {
      canvas.value?.focus({ preventScroll: true });
    }
  });
}

const sidebarBox = shallowRef({ top: 0, covered: SIDEBAR_WIDTH });
watch(sidebarOpen, (open) => {
  const rect = canvas.value?.getBoundingClientRect();
  if (!open || rect === undefined) {
    return;
  }
  sidebarBox.value = {
    top: rect.top + CANVAS_TOOLBAR_HEIGHT,
    covered: SIDEBAR_WIDTH - (window.innerWidth - rect.right),
  };
});

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
    if (isTextEntry(target)) {
      return;
    }
    event.stopPropagation();
    if (picking.value) {
      setPickMode();
      return;
    }
    dismiss();
    return;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && !picking.value) {
    event.preventDefault();
    deleteSelected();
  }
}

function select(next: Selection) {
  if (pickingParent.value) {
    if (next?.kind === "node") moveMarkedUnder(next.id);
    return;
  }
  if (connecting.value) {
    if (next?.kind === "node") pickTargets([next.id]);
    return;
  }
  clearMarked();
  picker.value = undefined;
  rawSelection.value = next;
}

function closeSidebar() {
  const current = picker.value;
  const shown = pickerView.value !== undefined;
  picker.value = undefined;
  rawSelection.value = null;
  if (shown && current?.mode === "merged-children") mark(new Set(current.parentIds));
}

function openPicker(next: Picker) {
  clearMarked();
  rawSelection.value = "nodeId" in next ? { kind: "node", id: next.nodeId } : null;
  picker.value = next;
}

const openPortPicker = (nodeId: string, side: PortSide) =>
  openPicker({ mode: side === "out" ? "children" : "parents", nodeId });

function groupEnds(source: DragSource, target: DropTarget) {
  if (
    source.kind !== "port" ||
    target.kind !== "node" ||
    !multiSelected.value ||
    !marked.value.has(source.nodeId) ||
    marked.value.has(target.id) ||
    !placed.value.has(target.id)
  ) {
    return undefined;
  }
  if (source.side === "out") {
    return { parents: markedIds.value, children: [target.id] };
  }
  return { parents: [target.id], children: markedIds.value };
}

function canDrop(source: DragSource, target: DropTarget) {
  const group = groupEnds(source, target);
  if (group !== undefined) {
    return joinGroups(props.design, group.parents, group.children, lastPart.value) !== undefined;
  }
  return planDrop(props.design, graph.value, source, target, lastPart.value) !== undefined;
}

function drop(source: DragSource, target: DropTarget) {
  const group = groupEnds(source, target);
  if (group !== undefined) {
    join(group.parents, group.children);
    return;
  }
  const result = planDrop(props.design, graph.value, source, target, lastPart.value);
  if (result === undefined) {
    return;
  }
  if ("picker" in result) {
    openPortPicker(result.picker.nodeId, result.picker.side);
    return;
  }
  apply(result.design);
}

function keepOpen(next?: Design) {
  if (next === undefined) {
    return undefined;
  }
  return { design: next };
}

function picked(
  current: Picker,
  chosen: Sample[],
  part: Part,
): { design: Design; id?: string } | undefined {
  if (current.mode === "start") {
    return keepOpen(addStartSamples(props.design, chosen));
  }
  if (current.mode === "children") {
    return keepOpen(addChildSamples(props.design, current.nodeId, chosen, part));
  }
  if (current.mode === "parents") {
    return keepOpen(addParentSamples(props.design, current.nodeId, chosen, part));
  }
  if (current.mode === "merged-children") {
    return addMergedChildren(props.design, current.parentIds, chosen, part);
  }
  const [sample] = chosen;
  if (sample === undefined) {
    return undefined;
  }
  const next = replaceWithSample(props.design, current.nodeId, sample);
  if (next === undefined) {
    return undefined;
  }
  return { design: next, id: sample.id };
}

function addSamples(chosen: Sample[], part: Part) {
  const current = picker.value;
  if (current === undefined) {
    return;
  }
  const result = picked(current, chosen, part);
  if (result === undefined) {
    return;
  }
  lastPart.value = part;
  if (result.id === undefined) {
    apply(result.design);
    return;
  }
  picker.value = undefined;
  apply(result.design, { kind: "node", id: result.id });
}
</script>

<template>
  <div ref="canvas" :class="styles.canvas" tabindex="-1" @keydown="onKeydown" @click="refocus">
    <DesignGraph
      :graph="graph"
      :selection="selection"
      :can-drop="canDrop"
      :covered-right="sidebarOpen ? sidebarBox.covered : 0"
      :marked="marked"
      :targets="shownTargets"
      :highlight="props.highlight"
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
    <PlSlideModal
      :class="styles.sidebar"
      :style="{ top: `${sidebarBox.top}px` }"
      :model-value="sidebarOpen"
      :width="`${SIDEBAR_WIDTH}px`"
      :close-on-outside-click="false"
      @update:model-value="dismiss"
      @click="refocus"
    >
      <template #title>{{ sidebarTitle }}</template>
      <div :class="styles.sheet" @keydown.esc="guardEscape" @keyup.esc="guardEscape">
        <section v-if="multiSelected" :class="styles.multi">
          <header :class="styles.header">
            <PlBtnGhost icon="add" size="small" @click="addMarkedChildren">Add children</PlBtnGhost>
            <PlBtnGhost
              icon="add"
              size="small"
              :disabled="!canInsertStep"
              @click="insertMarkedStep"
            >
              Insert step
            </PlBtnGhost>
            <PlBtnGhost size="small" :disabled="picking" @click="setPickMode('connect')">
              Connect to…
            </PlBtnGhost>
            <PlBtnGhost size="small" @click="mergeMarked">Merge</PlBtnGhost>
            <PlBtnGhost size="small" :disabled="!canMakeSplit" @click="makeMarkedSplit">
              Make one split
            </PlBtnGhost>
            <PlBtnGhost size="small" :disabled="picking" @click="setPickMode('move')">
              Move under…
            </PlBtnGhost>
            <PlBtnGhost icon="delete-bin" size="small" @click="deleteSelected">Delete</PlBtnGhost>
          </header>
          <div v-if="picking" :class="styles.header">
            <span :class="styles.note">
              {{
                pickingParent
                  ? "Click the new parent."
                  : `Click the children. ${connectTargets.size} picked.`
              }}
            </span>
            <PlBtnPrimary
              v-if="connecting"
              size="small"
              :disabled="connectTargets.size === 0"
              @click="connectMarked"
            >
              Connect
            </PlBtnPrimary>
            <PlBtnGhost size="small" @click="setPickMode()">Cancel</PlBtnGhost>
          </div>
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
          :samples="props.samples"
          :placed="placed"
          :mode="pickerView.mode"
          :part="lastPart"
          :show-connection="pickerView.showConnection"
          @add="addSamples"
        >
          <PlBtnGhost
            v-if="picker?.mode === 'start'"
            icon="add"
            size="small"
            @click="addShadowStart"
          >
            Unsequenced start
          </PlBtnGhost>
        </SamplePicker>
        <SelectionPanel
          v-else-if="selection !== null"
          :design="props.design"
          :graph="graph"
          :selection="selection"
          @change="apply"
          @delete="deleteSelected"
          @replace="(nodeId) => openPicker({ mode: 'replace', nodeId })"
        />
      </div>
    </PlSlideModal>
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

.sidebar :global(.pl-slide-modal__title) {
  padding-inline-end: 64px;
}

.sheet {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
}

.multi {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.note {
  margin: 0;
  color: var(--txt-03);
}
</style>
