import type { Graph, GraphNode, Part } from "./types";

/** A placed node: top-left corner and size, in graph pixels. */
export type NodeBox = { id: string; x: number; y: number; w: number; h: number };

/** A point in graph pixels. */
export type Point = { x: number; y: number };

/** A placed edge: its two ends and the x range of the column gap where it may change rows. */
export type PlacedEdge = { id: string; from: Point; to: Point; bend: [number, number] };

/** The result of `layout`. */
export type Layout = { nodes: NodeBox[]; edges: PlacedEdge[]; width: number; height: number };

/** Sizes and spacing the layout works with. */
export type LayoutOptions = {
  nodeSize: (node: GraphNode) => { w: number; h: number };
  rowHeight: number;
  columnGap: number;
  top: number;
};

const NAME_CHAR_WIDTH = 7.9;
const LABEL_CHAR_WIDTH = 6.2;

/** The connection types as the controls show them. */
export const partOptions: { label: string; value: Part }[] = [
  { label: "Whole", value: "whole" },
  { label: "Slice", value: "slice" },
  { label: "Remade", value: "remade" },
];

/** The name shown for a node: the sample id, a shadow's name, or a placeholder. */
export function displayName(node: GraphNode) {
  if (node.sequenced) {
    return node.name ?? node.id;
  }
  if (node.kind !== "material") {
    return node.kind === "pool" ? "Merge" : "Split";
  }
  return node.name ?? `Unsequenced ${node.id.replace(/^shadow-/, "")}`;
}

/** The node with the given id. */
export const nodeIn = (graph: Graph, id: string) => graph.nodes.find((item) => item.id === id);

/** The display name of the node with the given id, or an empty string. */
export function labelIn(graph: Graph, id: string) {
  const node = nodeIn(graph, id);
  if (node === undefined) {
    return "";
  }
  return displayName(node);
}

/** The line shown under a material name: its label values, or why it has none. */
export const nodeLabel = (node: GraphNode) => node.issue ?? Object.values(node.meta).join(" · ");

/** Estimates a node card size from its text, so the layout needs no DOM. */
export function estimateNodeSize(node: GraphNode) {
  if (node.kind === "junction") {
    return { w: 8, h: 8 };
  }
  if (!node.sequenced) {
    return { w: 14, h: 14 };
  }
  const text = Math.max(
    displayName(node).length * NAME_CHAR_WIDTH,
    nodeLabel(node).length * LABEL_CHAR_WIDTH,
  );
  return { w: Math.min(260, Math.max(120, Math.ceil(text) + 24)), h: 44 };
}

/** Default sizes, also used by the view. */
export const defaultLayoutOptions: LayoutOptions = {
  nodeSize: estimateNodeSize,
  rowHeight: 64,
  columnGap: 56,
  top: 12,
};

/** Places the graph left to right in step columns and tree rows (see the task notes). */
export function layout(graph: Graph, options: LayoutOptions = defaultLayoutOptions): Layout {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const parents = Map.groupBy(graph.edges, (edge) => edge.to);
  const children = Map.groupBy(graph.edges, (edge) => edge.from);
  const isJunction = (id: string) => byId.get(id)!.kind === "junction";
  const isShadow = (id: string) => !byId.get(id)!.sequenced;
  const isMerge = (id: string) => (parents.get(id)?.length ?? 0) > 1;

  const rank = stepRanks(graph, byId, parents);
  const columns = Array.from(new Set(rank.values())).sort((left, right) => left - right);
  const column = new Map(graph.nodes.map((node) => [node.id, columns.indexOf(rank.get(node.id)!)]));

  const slot = treeSlots(graph, parents, children);
  centerMerges(graph, parents, children, column, slot, isMerge);
  const minSlot = Math.min(...slot.values());

  const size = new Map(graph.nodes.map((node) => [node.id, options.nodeSize(node)]));
  const columnWidth = columns.map((_, index) =>
    Math.max(
      0,
      ...graph.nodes
        .filter((node) => column.get(node.id) === index && !isJunction(node.id))
        .map((node) => size.get(node.id)!.w),
    ),
  );
  const columnLeft = columnWidth.reduce<number[]>(
    (lefts, width, index) => [
      ...lefts,
      index === 0 ? 0 : lefts[index - 1] + columnWidth[index - 1] + options.columnGap,
    ],
    [],
  );
  const gapLeft = (leftColumn: number) => columnLeft[leftColumn] + columnWidth[leftColumn];
  const gapCenter = (leftColumn: number) => gapLeft(leftColumn) + options.columnGap / 2;
  const centerY = (id: string) => options.top + (slot.get(id)! - minSlot + 0.5) * options.rowHeight;

  const nodes = graph.nodes.map((node) => {
    const { w: width, h: height } = size.get(node.id)!;
    const index = column.get(node.id)!;
    const left = () => {
      if (node.kind === "junction") {
        return gapCenter(index) - width / 2;
      }
      if (!node.sequenced) {
        return columnLeft[index] + (columnWidth[index] - width) / 2;
      }
      return columnLeft[index];
    };
    return { id: node.id, x: left(), y: centerY(node.id) - height / 2, w: width, h: height };
  });
  const box = new Map(nodes.map((node) => [node.id, node]));

  const bendRange = (fromId: string, toId: string): [number, number] => {
    if (isJunction(toId)) {
      return [gapLeft(column.get(fromId)!), gapCenter(column.get(toId)!)];
    }
    if (isJunction(fromId)) {
      return [gapCenter(column.get(fromId)!), columnLeft[column.get(fromId)! + 1]];
    }
    const gap = isMerge(toId) ? column.get(toId)! - 1 : column.get(fromId)!;
    return [gapLeft(gap), columnLeft[gap + 1]];
  };
  const edges = graph.edges.map((edge) => {
    const from = box.get(edge.from)!;
    const to = box.get(edge.to)!;
    return {
      id: edge.id,
      from: { x: from.x + (isShadow(edge.from) ? from.w / 2 : from.w), y: centerY(edge.from) },
      to: { x: to.x + (isShadow(edge.to) ? to.w / 2 : 0), y: centerY(edge.to) },
      bend: bendRange(edge.from, edge.to),
    };
  });

  const width = Math.max(0, ...nodes.map((node) => node.x + node.w));
  const height = Math.max(0, ...nodes.map((node) => node.y + node.h)) + options.top;
  return { nodes, edges, width, height };
}

function stepRanks(
  graph: Graph,
  byId: Map<string, GraphNode>,
  parents: Map<string, Graph["edges"]>,
) {
  const rank = new Map<string, number>();
  const stepLength = (node: GraphNode, parent: GraphNode) => {
    if (node.kind === "junction") {
      return 0;
    }
    if (node.kind === "pool" || parent.kind === "pool") {
      return 0.5;
    }
    return 1;
  };
  const rankOf = (id: string): number => {
    const known = rank.get(id);
    if (known !== undefined) {
      return known;
    }
    const node = byId.get(id)!;
    const steps = (parents.get(id) ?? []).map(
      (edge) => rankOf(edge.from) + stepLength(node, byId.get(edge.from)!),
    );
    const value = Math.max(0, ...steps);
    rank.set(id, value);
    return value;
  };
  for (const node of graph.nodes) rankOf(node.id);
  return rank;
}

function treeSlots(
  graph: Graph,
  parents: Map<string, Graph["edges"]>,
  children: Map<string, Graph["edges"]>,
) {
  const slot = new Map<string, number>();
  const parentsSeen = new Map<string, number>();
  let nextLeaf = 0;

  const place = (id: string): number => {
    const treeChildren: string[] = [];
    for (const edge of children.get(id) ?? []) {
      const seen = (parentsSeen.get(edge.to) ?? 0) + 1;
      parentsSeen.set(edge.to, seen);
      if (seen === parents.get(edge.to)!.length) treeChildren.push(edge.to);
    }
    const childSlots = treeChildren.map(place);
    const value =
      childSlots.length === 0
        ? nextLeaf++
        : (Math.min(...childSlots) + Math.max(...childSlots)) / 2;
    slot.set(id, value);
    return value;
  };

  const roots = graph.nodes.filter((node) => !parents.has(node.id)).map((node) => node.id);
  const trees = roots.filter((id) => children.has(id));
  const loose = roots.filter((id) => !children.has(id));
  for (const id of [...trees, ...loose]) place(id);
  return slot;
}

function centerMerges(
  graph: Graph,
  parents: Map<string, Graph["edges"]>,
  children: Map<string, Graph["edges"]>,
  column: Map<string, number>,
  slot: Map<string, number>,
  isMerge: (id: string) => boolean,
) {
  const descendants = (id: string): Set<string> =>
    (children.get(id) ?? []).reduce(
      (found, edge) => found.union(descendants(edge.to)),
      new Set([id]),
    );
  const isCard = (id: string) => graph.nodes.find((node) => node.id === id)!.kind !== "junction";

  for (const merge of graph.nodes.filter((node) => isMerge(node.id))) {
    const parentSlots = parents.get(merge.id)!.map((edge) => slot.get(edge.from)!);
    const shift =
      parentSlots.reduce((sum, value) => sum + value, 0) / parentSlots.length - slot.get(merge.id)!;
    const moved = descendants(merge.id);
    const others = graph.nodes.filter((node) => !moved.has(node.id) && isCard(node.id));
    const overlaps = moved
      .values()
      .filter(isCard)
      .some((id) =>
        others.some(
          (other) =>
            column.get(other.id) === column.get(id) &&
            Math.abs(slot.get(id)! + shift - slot.get(other.id)!) < 1,
        ),
      );
    if (shift === 0 || overlaps) {
      continue;
    }
    for (const id of moved) slot.set(id, slot.get(id)! + shift);
  }
}
