import type { Graph } from "./types";

/**
 * The part of the graph one comparison covers: its samples, every node on the way between them,
 * and their closest shared ancestor (the material a separation divided, not just its junction).
 * Samples with no shared ancestor are lit on their own.
 */
export function litPart(
  graph: Graph,
  ids: Set<string>,
): { nodes: Set<string>; edges: Set<string> } {
  const parents = Map.groupBy(graph.edges, (edge) => edge.to);
  const memo = new Map<string, Set<string>>();
  const ancestors = (id: string): Set<string> => {
    let found = memo.get(id);
    if (found) return found;
    found = new Set();
    memo.set(id, found);
    for (const edge of parents.get(id) ?? []) {
      found.add(edge.from);
      for (const above of ancestors(edge.from)) found.add(above);
    }
    return found;
  };
  const kinds = new Map(graph.nodes.map((node) => [node.id, node.kind]));
  const present = [...ids].filter((id) => kinds.has(id));
  const common = present
    .map((id) => new Set([id, ...ancestors(id)]))
    .reduce<Set<string> | undefined>((a, b) => (a ? a.intersection(b) : b), undefined);
  // the lowest shared ancestor has every other shared one above it
  let top = [...(common ?? [])].find((c) =>
    [...common!].every((o) => o === c || ancestors(c).has(o)),
  );
  if (top !== undefined && kinds.get(top) === "junction") top = parents.get(top)?.[0]?.from ?? top;

  const stops = new Set([...present, ...(top !== undefined ? [top] : [])]);
  const nodes = new Set(stops);
  for (const id of present)
    for (const n of ancestors(id))
      if (ancestors(n).intersection(stops).size > 0 || stops.has(n)) nodes.add(n);
  const edges = new Set(
    graph.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to)).map((e) => e.id),
  );
  return { nodes, edges };
}
