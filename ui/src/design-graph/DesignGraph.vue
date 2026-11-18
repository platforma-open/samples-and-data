<script lang="ts" setup>
import { PlBtnGhost } from "@milaboratories/uikit";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useCssModule,
  useTemplateRef,
  watch,
} from "vue";
import type { DragSource, DropTarget, PortSide } from "./connect";
import { logicalEdge } from "./connect";
import type { PlacedEdge, Point } from "./layout";
import { displayName, layout, nodeLabel } from "./layout";
import type { Graph, GraphEdge, Selection } from "./types";

const props = defineProps<{
  graph: Graph;
  selection: Selection;
  canDrop: (source: DragSource, target: DropTarget) => boolean;
  coveredRight: number;
  marked: Set<string>;
}>();
const emit = defineEmits<{
  select: [selection: Selection];
  toggle: [nodeId: string];
  box: [nodeIds: string[]];
  port: [nodeId: string, side: PortSide];
  drop: [source: DragSource, target: DropTarget];
}>();
const styles = useCssModule();

const placed = computed(() => layout(props.graph));
const nodeStyles = computed(
  () =>
    new Map(
      placed.value.nodes.map((box) => [
        box.id,
        { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` },
      ]),
    ),
);
const curve = ({ from, to, bend: [start, end] }: PlacedEdge) => {
  const middle = (start + end) / 2;
  return `M${from.x},${from.y} H${start} C${middle},${from.y} ${middle},${to.y} ${end},${to.y} H${to.x}`;
};
const edgePaths = computed(() => new Map(placed.value.edges.map((path) => [path.id, curve(path)])));
const kinds = computed(() => new Map(props.graph.nodes.map((node) => [node.id, node.kind])));

const isSelected = (kind: "node" | "edge", id: string) =>
  props.selection?.kind === kind && props.selection.id === id;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const edgeTitle = (edge: GraphEdge) =>
  [edge.part, edge.step]
    .filter((part) => part !== null)
    .map(capitalize)
    .join(" · ");

const legendLines = ["slice", "whole", "remade"] as const;

function selectEdge(edge: GraphEdge) {
  if (kinds.value.get(edge.to) === "junction") {
    emit("select", { kind: "node", id: edge.to });
    return;
  }
  emit("select", { kind: "edge", id: edge.id, to: edge.to });
}

const viewport = useTemplateRef<HTMLDivElement>("viewport");
const view = shallowRef({ x: 0, y: 0, scale: 1 });
const percent = computed(() => `${Math.round(view.value.scale * 100)}%`);
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const FIT_PADDING = 32;
const MAX_WHEEL_ZOOM_DELTA = 10;

function zoomAt(factor: number, anchorX: number, anchorY: number) {
  const { x, y, scale } = view.value;
  const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
  const ratio = next / scale;
  view.value = {
    x: anchorX - (anchorX - x) * ratio,
    y: anchorY - (anchorY - y) * ratio,
    scale: next,
  };
}

function zoomCentered(factor: number) {
  const element = viewport.value!;
  zoomAt(factor, element.clientWidth / 2, element.clientHeight / 2);
}

function fit() {
  const element = viewport.value!;
  const { width, height } = placed.value;
  const scale = Math.max(
    MIN_SCALE,
    Math.min(
      1,
      (element.clientWidth - 2 * FIT_PADDING) / Math.max(width, 1),
      (element.clientHeight - 2 * FIT_PADDING) / Math.max(height, 1),
    ),
  );
  view.value = {
    x: (element.clientWidth - width * scale) / 2,
    y: (element.clientHeight - height * scale) / 2,
    scale,
  };
}

function onWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) {
    const rect = viewport.value!.getBoundingClientRect();
    const delta = Math.max(-MAX_WHEEL_ZOOM_DELTA, Math.min(MAX_WHEEL_ZOOM_DELTA, event.deltaY));
    zoomAt(Math.exp(-delta * 0.01), event.clientX - rect.left, event.clientY - rect.top);
    return;
  }
  view.value = { ...view.value, x: view.value.x - event.deltaX, y: view.value.y - event.deltaY };
}

let drag: { pointerX: number; pointerY: number; x: number; y: number; moved: boolean } | undefined;

const selectionBox = shallowRef<{ start: Point; end: Point }>();
const boxRect = computed(() => {
  const current = selectionBox.value;
  if (current === undefined) {
    return undefined;
  }
  return {
    left: Math.min(current.start.x, current.end.x),
    top: Math.min(current.start.y, current.end.y),
    right: Math.max(current.start.x, current.end.x),
    bottom: Math.max(current.start.y, current.end.y),
  };
});
const boxStyle = computed(() => {
  const rect = boxRect.value;
  if (rect === undefined) {
    return undefined;
  }
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.right - rect.left}px`,
    height: `${rect.bottom - rect.top}px`,
  };
});

function finishBox() {
  const rect = boxRect.value;
  selectionBox.value = undefined;
  if (rect === undefined) {
    return;
  }
  const inside = placed.value.nodes.filter(
    (node) =>
      kinds.value.get(node.id) === "material" &&
      node.x < rect.right &&
      node.x + node.w > rect.left &&
      node.y < rect.bottom &&
      node.y + node.h > rect.top,
  );
  emit(
    "box",
    inside.map((node) => node.id),
  );
}

function cancelPointer() {
  selectionBox.value = undefined;
  drag = undefined;
}

function onNodeClick(nodeId: string, event: MouseEvent) {
  if (event.metaKey || event.ctrlKey || event.shiftKey) {
    emit("toggle", nodeId);
    return;
  }
  emit("select", { kind: "node", id: nodeId });
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }
  viewport.value!.setPointerCapture(event.pointerId);
  if (event.shiftKey) {
    const point = toGraphPoint(event.clientX, event.clientY);
    selectionBox.value = { start: point, end: point };
    return;
  }
  drag = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    x: view.value.x,
    y: view.value.y,
    moved: false,
  };
}

function onPointerMove(event: PointerEvent) {
  if (selectionBox.value !== undefined) {
    selectionBox.value = {
      ...selectionBox.value,
      end: toGraphPoint(event.clientX, event.clientY),
    };
    return;
  }
  if (drag === undefined) {
    return;
  }
  const deltaX = event.clientX - drag.pointerX;
  const deltaY = event.clientY - drag.pointerY;
  if (Math.hypot(deltaX, deltaY) > 3) drag.moved = true;
  if (drag.moved) view.value = { ...view.value, x: drag.x + deltaX, y: drag.y + deltaY };
}

function onPointerUp() {
  if (selectionBox.value !== undefined) {
    finishBox();
    return;
  }
  if (drag !== undefined && !drag.moved) emit("select", null);
  drag = undefined;
}

type Wire = {
  source: DragSource;
  start: Point;
  end: Point;
  target: DropTarget | undefined;
  allowed: boolean;
  moved: boolean;
  pointer: Point;
};
const wire = shallowRef<Wire>();
const boxes = computed(() => new Map(placed.value.nodes.map((box) => [box.id, box])));

const selectedEnds = computed(() => {
  const selection = props.selection;
  if (selection?.kind !== "edge" || logicalEdge(props.graph, selection.id) === undefined) {
    return undefined;
  }
  const path = placed.value.edges.find((item) => item.id === selection.id);
  if (path === undefined) {
    return undefined;
  }
  return { edgeId: selection.id, parent: path.from, child: path.to };
});

const toGraphPoint = (clientX: number, clientY: number) => {
  const rect = viewport.value!.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.value.x) / view.value.scale,
    y: (clientY - rect.top - view.value.y) / view.value.scale,
  };
};

function hitTest(clientX: number, clientY: number): DropTarget | undefined {
  const element = document.elementFromPoint(clientX, clientY);
  if (element === null || !viewport.value!.contains(element) || element.closest("[data-chrome]")) {
    return undefined;
  }
  const nodeId = element.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
  if (nodeId !== undefined) {
    return { kind: "node", id: nodeId };
  }
  const edgeId = element.closest<SVGElement>("[data-edge-id]")?.dataset.edgeId;
  if (edgeId !== undefined) {
    return { kind: "edge", id: edgeId };
  }
  return { kind: "empty" };
}

function startWire(source: DragSource, start: Point, event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }
  window.addEventListener("pointermove", onWireMove);
  window.addEventListener("pointerup", onWireUp);
  window.addEventListener("pointercancel", endWire);
  wire.value = {
    source,
    start,
    end: start,
    target: undefined,
    allowed: false,
    moved: false,
    pointer: { x: event.clientX, y: event.clientY },
  };
}

function startPort(nodeId: string, side: PortSide, event: PointerEvent) {
  const box = boxes.value.get(nodeId)!;
  const portOffset = props.graph.nodes.find((node) => node.id === nodeId)?.sequenced
    ? 0
    : SHADOW_PORT_OFFSET;
  const start = {
    x: side === "out" ? box.x + box.w + portOffset : box.x - portOffset,
    y: box.y + box.h / 2,
  };
  startWire({ kind: "port", nodeId, side }, start, event);
}

function onWireMove(event: PointerEvent) {
  const current = wire.value;
  if (current === undefined) {
    return;
  }
  const moved =
    current.moved ||
    Math.hypot(event.clientX - current.pointer.x, event.clientY - current.pointer.y) > 3;
  const target = hitTest(event.clientX, event.clientY);
  const allowed = target !== undefined && props.canDrop(current.source, target);
  wire.value = {
    ...current,
    moved,
    target,
    allowed,
    end: toGraphPoint(event.clientX, event.clientY),
  };
}

function endWire() {
  window.removeEventListener("pointermove", onWireMove);
  window.removeEventListener("pointerup", onWireUp);
  window.removeEventListener("pointercancel", endWire);
  const current = wire.value;
  wire.value = undefined;
  return current;
}

function onWireUp() {
  const current = endWire();
  if (current === undefined) {
    return;
  }
  if (!current.moved && current.source.kind === "port") {
    emit("port", current.source.nodeId, current.source.side);
    return;
  }
  if (current.moved && current.allowed && current.target !== undefined) {
    emit("drop", current.source, current.target);
  }
}

const REVEAL_MARGIN = 24;
const SHADOW_PORT_OFFSET = 11;

function selectedBounds() {
  const selection = props.selection;
  if (selection === null) {
    const markedBoxes = Array.from(props.marked, (id) => boxes.value.get(id)).filter(
      (box) => box !== undefined,
    );
    if (markedBoxes.length === 0) {
      return undefined;
    }
    return {
      left: Math.min(...markedBoxes.map((box) => box.x)),
      right: Math.max(...markedBoxes.map((box) => box.x + box.w)),
    };
  }
  if (selection.kind === "node") {
    const box = boxes.value.get(selection.id);
    if (box === undefined) {
      return undefined;
    }
    return { left: box.x, right: box.x + box.w };
  }
  const path = placed.value.edges.find((item) => item.id === selection.id);
  if (path === undefined) {
    return undefined;
  }
  return { left: path.from.x, right: path.to.x };
}

function revealSelection() {
  const bounds = selectedBounds();
  if (bounds === undefined || viewport.value === null) {
    return;
  }
  const { x, scale } = view.value;
  const visibleRight = viewport.value.clientWidth - props.coveredRight - REVEAL_MARGIN;
  const overflow = bounds.right * scale + x - visibleRight;
  const room = bounds.left * scale + x - REVEAL_MARGIN;
  const shift = Math.min(overflow, room);
  if (shift <= 0) {
    return;
  }
  view.value = { ...view.value, x: x - shift };
}

watch(
  [() => props.selection, () => props.coveredRight, () => Array.from(props.marked).join("\n")],
  () => nextTick(revealSelection),
);

onBeforeUnmount(endWire);

const isTarget = (kind: "node" | "edge", id: string) =>
  wire.value !== undefined &&
  wire.value.moved &&
  wire.value.target?.kind === kind &&
  wire.value.target.id === id;

const wirePath = computed(() => {
  const current = wire.value;
  if (current === undefined) {
    return "";
  }
  return `M${current.start.x},${current.start.y} L${current.end.x},${current.end.y}`;
});

onMounted(fit);
</script>

<template>
  <div
    ref="viewport"
    :class="[styles.viewport, selectionBox !== undefined && styles.boxing]"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="cancelPointer"
  >
    <div
      :class="styles.stage"
      :style="{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }"
    >
      <svg :class="styles.edges" :width="placed.width" :height="placed.height">
        <g
          v-for="edge in props.graph.edges"
          :key="edge.id"
          :data-edge-id="edge.id"
          :class="[
            styles.edge,
            styles[edge.part],
            isSelected('edge', edge.id) && styles.selected,
            isTarget('edge', edge.id) && (wire?.allowed ? styles.target : styles.refused),
          ]"
          @pointerdown.stop
          @click="selectEdge(edge)"
        >
          <title>{{ edgeTitle(edge) }}</title>
          <path :class="styles.hit" :d="edgePaths.get(edge.id)" />
          <path :class="styles.line" :d="edgePaths.get(edge.id)" />
        </g>
        <path
          v-if="wire?.moved"
          :class="[styles.wire, !wire.allowed && styles.refused]"
          :d="wirePath"
        />
      </svg>
      <div
        v-for="node in props.graph.nodes"
        :key="node.id"
        :data-node-id="node.id"
        :class="[
          styles.node,
          !node.sequenced && styles.shadow,
          (isSelected('node', node.id) || props.marked.has(node.id)) && styles.selected,
          isTarget('node', node.id) && (wire?.allowed ? styles.target : styles.refused),
        ]"
        :style="nodeStyles.get(node.id)"
        @pointerdown.stop
        @click="(event: MouseEvent) => onNodeClick(node.id, event)"
      >
        <template v-if="node.kind === 'material'">
          <span
            :class="[styles.port, styles.portIn]"
            title="Add parents"
            @pointerdown.stop="(event: PointerEvent) => startPort(node.id, 'in', event)"
            @click.stop
          />
          <span
            :class="[styles.port, styles.portOut]"
            title="Add children"
            @pointerdown.stop="(event: PointerEvent) => startPort(node.id, 'out', event)"
            @click.stop
          />
        </template>
        <template v-if="node.sequenced">
          <div :class="styles.name">{{ node.id }}</div>
          <div :class="styles.label">{{ nodeLabel(node) }}</div>
        </template>
        <span
          v-else-if="node.kind === 'material'"
          :class="[styles.shadowName, node.name === undefined && styles.placeholder]"
          :title="displayName(node)"
        >
          {{ displayName(node) }}
        </span>
      </div>
      <div v-if="boxStyle !== undefined" :class="styles.selectionBox" :style="boxStyle" />
      <template v-if="selectedEnds !== undefined">
        <span
          v-for="end in ['parent', 'child'] as const"
          :key="end"
          :class="styles.handle"
          :style="{ left: `${selectedEnds[end].x}px`, top: `${selectedEnds[end].y}px` }"
          :title="end === 'parent' ? 'Drag to another parent' : 'Drag to another child'"
          @pointerdown.stop="
            (event: PointerEvent) =>
              startWire(
                { kind: 'end', edgeId: selectedEnds!.edgeId, end },
                selectedEnds![end],
                event,
              )
          "
        />
      </template>
    </div>
    <div :class="styles.top" data-chrome @pointerdown.stop>
      <div :class="styles.box"><slot name="toolbar" /></div>
      <div :class="[styles.box, styles.legend]">
        <span><i :class="styles.swatch" />shadow node</span>
        <span v-for="part in legendLines" :key="part" :class="styles[part]">
          <svg width="24" height="6"><path :class="styles.line" d="M1,3 L24,3" /></svg>
          {{ part }}
        </span>
      </div>
    </div>
    <div :class="[styles.box, styles.zoom]" data-chrome @pointerdown.stop>
      <PlBtnGhost icon="zoom-out" size="small" title="Zoom out" @click="zoomCentered(1 / 1.25)" />
      <span :class="styles.percent">{{ percent }}</span>
      <PlBtnGhost icon="zoom-in" size="small" title="Zoom in" @click="zoomCentered(1.25)" />
      <PlBtnGhost icon="maximize" size="small" title="Fit to view" @click="fit" />
    </div>
  </div>
</template>

<style module>
.viewport {
  position: relative;
  overflow: hidden;
  block-size: 100%;
  cursor: grab;
  touch-action: none;
  user-select: none;

  &:active {
    cursor: grabbing;
  }

  &.boxing {
    cursor: crosshair;
  }
}

.stage {
  position: absolute;
  transform-origin: 0 0;
}

.edges {
  position: absolute;
  overflow: visible;
}

.edge {
  cursor: pointer;
}

.hit {
  fill: none;
  stroke: transparent;
  stroke-width: 10;
}

.line {
  fill: none;
  stroke: var(--txt-03);
  stroke-width: 1.5;
}

.whole .line {
  stroke-dasharray: 6 4;
}

.remade .line {
  stroke-dasharray: 0 4;
  stroke-linecap: round;
  stroke-width: 2;
}

.pooled .line {
  stroke-width: 1;
}

.edge:hover .line {
  stroke: var(--txt-01);
}

.edge.selected .line,
.edge.target .line {
  stroke: var(--border-color-focus);
  stroke-width: 2.5;
}

.edge.refused .line {
  stroke: var(--border-color-error);
}

.wire {
  stroke: var(--border-color-focus);
  stroke-dasharray: 4 3;
  stroke-width: 1.5;
  pointer-events: none;

  &.refused {
    stroke: var(--border-color-error);
  }
}

.port {
  position: absolute;
  inset-block-start: 50%;
  inline-size: 10px;
  block-size: 10px;
  border: 1px dashed var(--ic-02);
  border-radius: 50%;
  background: var(--bg-elevated-01);
  opacity: 0;
  translate: 0 -50%;
  cursor: crosshair;

  &:hover {
    border-color: var(--border-color-focus);
  }
}

.portIn {
  inset-inline-start: -6px;
}

.portOut {
  inset-inline-end: -6px;
}

.shadow .portIn {
  inset-inline-start: -16px;
}

.shadow .portOut {
  inset-inline-end: -16px;
}

.selectionBox {
  position: absolute;
  border: 1px dashed var(--border-color-focus);
  background: var(--border-color-focus-shadow);
  pointer-events: none;
}

.handle {
  position: absolute;
  inline-size: 10px;
  block-size: 10px;
  border: 1px solid var(--border-color-focus);
  border-radius: 50%;
  background: var(--bg-elevated-01);
  translate: -50% -50%;
  cursor: grab;
}

.node {
  position: absolute;
  padding: 4px 10px;
  border: 1px solid var(--border-color-default);
  border-radius: 6px;
  background: var(--bg-elevated-01);
  cursor: pointer;

  &:hover {
    border-color: var(--border-color-hover);
  }

  &.shadow {
    padding: 0;
    border-style: dashed;
    border-color: var(--ic-02);
    border-radius: 50%;
    color: var(--txt-03);

    &:hover:not(.selected) {
      border-color: var(--border-color-default);
      color: var(--txt-01);
    }
  }

  &.selected,
  &.target {
    border-color: var(--border-color-focus);
    box-shadow: 0 0 0 3px var(--border-color-focus-shadow);
  }

  &.refused {
    border-color: var(--border-color-error);
  }

  &:hover .port,
  &.selected .port {
    opacity: 1;
  }
}

.shadowName {
  position: absolute;
  inset-block-end: calc(100% + 2px);
  inset-inline-start: 50%;
  translate: -50% 0;
  max-inline-size: 64px;
  overflow: hidden;
  font-family: var(--font-family-monospace);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.placeholder {
    color: var(--txt-mask);
  }
}

.name,
.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name {
  font-family: var(--font-family-monospace);
  font-size: 13px;
  font-weight: 600;
}

.label {
  font-size: 11px;
  color: var(--txt-03);
}

.top {
  position: absolute;
  inset-block-start: 8px;
  inset-inline-start: 8px;
  display: flex;
  gap: 8px;
}

.box {
  display: flex;
  align-items: center;
  border: 1px solid var(--border-color-div-grey);
  border-radius: 6px;
  background: var(--bg-elevated-01);
  cursor: default;
}

.zoom {
  position: absolute;
  inset-block-start: 8px;
  inset-inline-end: 8px;
}

.legend {
  gap: 16px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--txt-03);

  & span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.swatch {
  inline-size: 12px;
  block-size: 12px;
  border: 1px dashed var(--ic-02);
  border-radius: 50%;
}

.percent {
  min-inline-size: 40px;
  font-size: 12px;
  text-align: center;
}
</style>
