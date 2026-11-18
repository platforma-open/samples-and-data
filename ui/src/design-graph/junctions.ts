import { edgeId } from "./toGraph";
import type { Graph, GraphEdge, GraphNode } from "./types";

/** Id of the junction of one separation: the parent and the split name. */
export const junctionId = (parentId: string, split: string) => `${parentId}::split::${split}`;

function groupKey(edge: GraphEdge, kinds: Map<string, GraphNode["kind"]>) {
  if (edge.part !== "slice" || edge.split === null || kinds.get(edge.from) !== "material") {
    return undefined;
  }
  return junctionId(edge.from, edge.split);
}

/** Adds a hidden junction node for each separation with two or more partitions. */
export function withJunctions(graph: Graph): Graph {
  const kinds = new Map(graph.nodes.map((node) => [node.id, node.kind]));
  const groups = Map.groupBy(
    graph.edges.filter((edge) => groupKey(edge, kinds) !== undefined),
    (edge) => groupKey(edge, kinds)!,
  );
  const junctions = new Map(groups.entries().filter(([, members]) => members.length >= 2));

  const edges = graph.edges.flatMap((edge) => {
    const key = groupKey(edge, kinds);
    if (key === undefined || !junctions.has(key)) {
      return [edge];
    }
    const branch = { ...edge, id: edgeId(key, edge.to), from: key, inserted: true };
    if (junctions.get(key)![0] !== edge) {
      return [branch];
    }
    const stem: GraphEdge = {
      id: edgeId(edge.from, key),
      from: edge.from,
      to: key,
      part: "slice",
      split: edge.split,
      step: null,
      inserted: true,
    };
    return [stem, branch];
  });

  const nodes = junctions
    .keys()
    .map((id) => ({ id, kind: "junction" as const, sequenced: false, meta: {}, hidden: true }))
    .toArray();
  return { nodes: [...graph.nodes, ...nodes], edges };
}

/** The parent, split and partitions of a junction node, read from its edges. */
export function junctionOf(graph: Graph, id?: string) {
  const isJunction = graph.nodes.some((node) => node.id === id && node.kind === "junction");
  const stem = graph.edges.find((edge) => edge.to === id);
  if (!isJunction || id === undefined || stem?.split === undefined || stem.split === null) {
    return undefined;
  }
  const partitions = graph.edges.filter((edge) => edge.from === id).map((edge) => edge.to);
  return { parentId: stem.from, split: stem.split, partitions };
}
