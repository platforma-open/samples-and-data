import type { Design, Graph, GraphNode, Material, MaterialFrom } from "./types";

/** Id of the pool node inserted in front of a material with several parents. */
export const poolId = (childId: string) => `${childId}::pool`;

/** Id of the edge from one node to another. */
export const edgeId = (from: string, to: string) => `${from}->${to}`;

/** The parent ids of an authored `from`, always as an array. */
export const parentsOf = (from: Pick<MaterialFrom, "of">): string[] =>
  typeof from.of === "string" ? [from.of] : from.of;

/** Converts the authored design into nodes and edges (see GRAPH.md in the experiment-design spec). */
export function toGraph(design: Design): Graph {
  const ids = new Set(design.materials.map((material) => material.id));
  const parts = design.materials.map((material) => materialToGraph(material, ids));
  const graph = {
    nodes: parts.flatMap((part) => part.nodes),
    edges: parts.flatMap((part) => part.edges),
  };
  assertAcyclic(graph);
  return graph;
}

function materialToGraph(material: Material, ids: Set<string>): Graph {
  const node: GraphNode = {
    id: material.id,
    kind: "material",
    sequenced: material.sequenced,
    meta: material.meta,
    ...(material.name !== undefined && { name: material.name }),
    ...(material.issue !== undefined && { issue: material.issue }),
  };
  if (material.from === undefined) {
    return { nodes: [node], edges: [] };
  }

  const parents = parentsOf(material.from);
  const unknown = parents.find((parent) => !ids.has(parent));
  if (unknown !== undefined) {
    throw new Error(`Material "${material.id}" is made from unknown material "${unknown}"`);
  }
  if (material.from.part === "slice" && material.from.split === undefined) {
    throw new Error(`Material "${material.id}" is a slice without a split`);
  }
  const authored = {
    part: material.from.part,
    split: material.from.part === "slice" ? (material.from.split ?? null) : null,
    step: material.from.step ?? null,
  };

  if (parents.length === 1) {
    const parent = parents[0];
    return {
      nodes: [node],
      edges: [
        {
          id: edgeId(parent, material.id),
          from: parent,
          to: material.id,
          ...authored,
          inserted: false,
        },
      ],
    };
  }

  const pool = poolId(material.id);
  const pooled = parents.map((parent) => ({
    id: edgeId(parent, pool),
    from: parent,
    to: pool,
    part: "pooled" as const,
    split: null,
    step: null,
    inserted: true,
  }));
  return {
    nodes: [node, { id: pool, kind: "pool", sequenced: false, meta: {} }],
    edges: [
      ...pooled,
      { id: edgeId(pool, material.id), from: pool, to: material.id, ...authored, inserted: true },
    ],
  };
}

function assertAcyclic(graph: Graph) {
  const visiting = new Set<string>();
  const done = new Set<string>();
  const children = Map.groupBy(graph.edges, (edge) => edge.from);
  const visit = (id: string) => {
    if (done.has(id)) {
      return;
    }
    if (visiting.has(id)) throw new Error(`The design has a cycle through "${id}"`);
    visiting.add(id);
    for (const edge of children.get(id) ?? []) visit(edge.to);
    visiting.delete(id);
    done.add(id);
  };
  for (const node of graph.nodes) visit(node.id);
}
