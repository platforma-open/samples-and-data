import { edgeId } from "./toGraph";
import type { Graph, GraphEdge } from "./types";

/** Id of the junction of one separation: the parent and the split name. */
export const junctionId = (parentId: string, split: string) => `${parentId}::split::${split}`;

function groupKey(edge: GraphEdge, splitters: Set<string>) {
  if (edge.part !== "slice" || edge.split === null || !splitters.has(edge.from)) {
    return undefined;
  }
  return junctionId(edge.from, edge.split);
}

/** Adds a junction for each separation with two or more partitions, except the only separation of a shadow node. */
export function withJunctions(graph: Graph): Graph {
  const splits = Map.groupBy(
    graph.edges.filter((edge) => edge.part === "slice" && edge.split !== null),
    (edge) => edge.from,
  );
  const separations = (id: string) => new Set(splits.get(id)?.map((edge) => edge.split)).size;
  const splitters = new Set(
    graph.nodes
      .filter((node) => node.kind === "material" && (node.sequenced || separations(node.id) > 1))
      .map((node) => node.id),
  );
  const groups = Map.groupBy(
    graph.edges.filter((edge) => groupKey(edge, splitters) !== undefined),
    (edge) => groupKey(edge, splitters)!,
  );
  const junctions = new Map(groups.entries().filter(([, members]) => members.length >= 2));

  const edges = graph.edges.flatMap((edge) => {
    const key = groupKey(edge, splitters);
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
    .map((id) => ({ id, kind: "junction" as const, sequenced: false, meta: {} }))
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
