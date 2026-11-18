<script lang="ts" setup>
import { PlBtnGhost } from "@milaboratories/uikit";
import { computed, onMounted, shallowRef, useCssModule, useTemplateRef } from "vue";
import type { PlacedEdge } from "./layout";
import { layout, nodeLabel } from "./layout";
import type { Graph, GraphEdge, Selection } from "./types";

const props = defineProps<{ graph: Graph; selection: Selection }>();
const emit = defineEmits<{ select: [selection: Selection] }>();
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

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }
  viewport.value!.setPointerCapture(event.pointerId);
  drag = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    x: view.value.x,
    y: view.value.y,
    moved: false,
  };
}

function onPointerMove(event: PointerEvent) {
  if (drag === undefined) {
    return;
  }
  const deltaX = event.clientX - drag.pointerX;
  const deltaY = event.clientY - drag.pointerY;
  if (Math.hypot(deltaX, deltaY) > 3) drag.moved = true;
  if (drag.moved) view.value = { ...view.value, x: drag.x + deltaX, y: drag.y + deltaY };
}

function onPointerUp() {
  if (drag !== undefined && !drag.moved) emit("select", null);
  drag = undefined;
}

onMounted(fit);
</script>

<template>
  <div
    ref="viewport"
    :class="styles.viewport"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      :class="styles.stage"
      :style="{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }"
    >
      <svg :class="styles.edges" :width="placed.width" :height="placed.height">
        <g
          v-for="edge in props.graph.edges"
          :key="edge.id"
          :class="[styles.edge, styles[edge.part], isSelected('edge', edge.id) && styles.selected]"
          @pointerdown.stop
          @click="selectEdge(edge)"
        >
          <title>{{ edgeTitle(edge) }}</title>
          <path :class="styles.hit" :d="edgePaths.get(edge.id)" />
          <path :class="styles.line" :d="edgePaths.get(edge.id)" />
        </g>
      </svg>
      <div
        v-for="node in props.graph.nodes"
        :key="node.id"
        :class="[
          styles.node,
          styles[node.kind],
          node.hidden && styles.hidden,
          node.kind === 'material' && !node.sequenced && styles.unsequenced,
          isSelected('node', node.id) && styles.selected,
        ]"
        :style="nodeStyles.get(node.id)"
        @pointerdown.stop
        @click="emit('select', { kind: 'node', id: node.id })"
      >
        <template v-if="node.kind === 'material'">
          <div :class="styles.name">{{ node.id }}</div>
          <div :class="styles.label">{{ nodeLabel(node) }}</div>
        </template>
        <template v-else-if="node.kind === 'pool'">pool</template>
      </div>
    </div>
    <div :class="styles.top" @pointerdown.stop>
      <div :class="styles.box"><slot name="toolbar" /></div>
      <div :class="[styles.box, styles.legend]">
        <span><i :class="[styles.swatch, styles.unsequenced]" />not sequenced</span>
        <span><i :class="[styles.swatch, styles.pool]" />pool</span>
        <span v-for="part in legendLines" :key="part" :class="styles[part]">
          <svg width="24" height="6"><path :class="styles.line" d="M1,3 L24,3" /></svg>
          {{ part }}
        </span>
      </div>
    </div>
    <div :class="[styles.box, styles.zoom]" @pointerdown.stop>
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

.edge.selected .line {
  stroke: var(--border-color-focus);
  stroke-width: 2.5;
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

  &.unsequenced {
    background: var(--bg-elevated-02);
  }

  &.pool {
    display: grid;
    place-items: center;
    padding: 0;
    border-style: dashed;
    border-radius: 12px;
    font-size: 11px;
    color: var(--txt-03);
  }

  &.junction {
    padding: 0;
    border-radius: 50%;
  }

  &.selected {
    border-color: var(--border-color-focus);
    box-shadow: 0 0 0 3px var(--border-color-focus-shadow);
  }

  &.hidden {
    opacity: 0;
    transition: opacity 0.15s;

    &:hover,
    &.selected {
      opacity: 1;
    }
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
  inline-size: 20px;
  block-size: 12px;
  border: 1px solid var(--border-color-default);
  border-radius: 3px;

  &.unsequenced {
    background: var(--bg-elevated-02);
  }

  &.pool {
    border-style: dashed;
    border-radius: 6px;
  }
}

.percent {
  min-inline-size: 40px;
  font-size: 12px;
  text-align: center;
}
</style>
