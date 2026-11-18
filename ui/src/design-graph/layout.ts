import type { Graph, GraphNode } from "./types";

/** A placed node: top-left corner and size, in graph pixels. */
export type NodeBox = { id: string; x: number; y: number; w: number; h: number };

/** A routed edge: a right-angle polyline between two nodes. */
export type EdgePath = { id: string; points: [number, number][] };

/** The result of `layout`. */
export type Layout = { nodes: NodeBox[]; edges: EdgePath[]; width: number; height: number };

/** Sizes and spacing the layout works with. */
export type LayoutOptions = {
  nodeSize: (node: GraphNode) => { w: number; h: number };
  rowHeight: number;
  columnGap: number;
  top: number;
};

const NAME_CHAR_WIDTH = 7.9;
const LABEL_CHAR_WIDTH = 6.2;

/** The label line shown under a material name. */
export const nodeLabel = (node: GraphNode) => Object.values(node.meta).join(" · ");

/** Estimates a node card size from its text, so the layout needs no DOM. */
export function estimateNodeSize(node: GraphNode) {
  if (node.kind === "pool") {
    return { w: 44, h: 24 };
  }
  if (node.kind === "junction") {
    return { w: 14, h: 14 };
  }
  const text = Math.max(
    node.id.length * NAME_CHAR_WIDTH,
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

  const rank = stepRanks(graph, byId, parents);
  const columns = Array.from(new Set(rank.values())).sort((left, right) => left - right);
  const column = new Map(graph.nodes.map((node) => [node.id, columns.indexOf(rank.get(node.id)!)]));

  const slot = treeSlots(graph, parents, children);
  centerPools(graph, parents, children, column, slot);
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
  const gapCenter = (leftColumn: number) =>
    columnLeft[leftColumn] + columnWidth[leftColumn] + options.columnGap / 2;
  const centerY = (id: string) => options.top + (slot.get(id)! - minSlot + 0.5) * options.rowHeight;

  const junctionsByParent = Map.groupBy(
    graph.nodes.filter((node) => node.kind === "junction"),
    (node) => parents.get(node.id)![0].from,
  );
  const junctionOffset = (id: string, width: number) => {
    const siblings = junctionsByParent.get(parents.get(id)![0].from)!;
    const room = options.columnGap / 2 - width / 2 - 2;
    const spacing = Math.min(8, room / siblings.length);
    return (siblings.findIndex((node) => node.id === id) + 1) * spacing;
  };

  const nodes = graph.nodes.map((node) => {
    const { w: width, h: height } = size.get(node.id)!;
    const index = column.get(node.id)!;
    const left = {
      material: () => columnLeft[index],
      pool: () => columnLeft[index] + (columnWidth[index] - width) / 2,
      junction: () => gapCenter(index) + junctionOffset(node.id, width) - width / 2,
    }[node.kind]();
    return { id: node.id, x: left, y: centerY(node.id) - height / 2, w: width, h: height };
  });
  const box = new Map(nodes.map((node) => [node.id, node]));

  const edges = graph.edges.map((edge) => {
    const from = box.get(edge.from)!;
    const to = box.get(edge.to)!;
    const fromY = from.y + from.h / 2;
    const toY = to.y + to.h / 2;
    if (isJunction(edge.to)) {
      const junctionX = to.x + to.w / 2;
      return {
        id: edge.id,
        points: [
          [from.x + from.w, fromY],
          [junctionX, fromY],
          [junctionX, toY],
        ] satisfies [number, number][],
      };
    }
    if (isJunction(edge.from)) {
      const junctionX = from.x + from.w / 2;
      return {
        id: edge.id,
        points: [
          [junctionX, fromY],
          [junctionX, toY],
          [to.x, toY],
        ] satisfies [number, number][],
      };
    }
    const intoPool = byId.get(edge.to)!.kind === "pool";
    const busX = gapCenter(intoPool ? column.get(edge.to)! - 1 : column.get(edge.from)!);
    return {
      id: edge.id,
      points: [
        [from.x + from.w, fromY],
        [busX, fromY],
        [busX, toY],
        [to.x, toY],
      ] satisfies [number, number][],
    };
  });

  const width = Math.max(0, ...nodes.map((node) => node.x + node.w));
  const height = Math.max(0, ...nodes.map((node) => node.y + node.h)) + options.top;
  return { nodes, edges, width, height };
}

function roundOf(node: GraphNode): number | undefined {
  const round = Number(node.meta.round);
  if (node.kind !== "material" || node.meta.round === undefined || !Number.isFinite(round)) {
    return undefined;
  }
  return round;
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
    const value = Math.max(0, ...steps, roundOf(node) ?? 0);
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

  for (const node of graph.nodes) {
    if (!parents.has(node.id)) place(node.id);
  }
  return slot;
}

function centerPools(
  graph: Graph,
  parents: Map<string, Graph["edges"]>,
  children: Map<string, Graph["edges"]>,
  column: Map<string, number>,
  slot: Map<string, number>,
) {
  const descendants = (id: string): Set<string> =>
    (children.get(id) ?? []).reduce(
      (found, edge) => found.union(descendants(edge.to)),
      new Set([id]),
    );
  const isCard = (id: string) => graph.nodes.find((node) => node.id === id)!.kind !== "junction";

  for (const pool of graph.nodes.filter((node) => node.kind === "pool")) {
    const parentSlots = parents.get(pool.id)!.map((edge) => slot.get(edge.from)!);
    const shift =
      parentSlots.reduce((sum, value) => sum + value, 0) / parentSlots.length - slot.get(pool.id)!;
    const moved = descendants(pool.id);
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
