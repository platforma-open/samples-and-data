/** What part of the parent's variety a material holds (authored values). */
export type Part = "whole" | "slice" | "remade";

/** Whether a step is one of a repeated series. */
export type Step = "round" | "timecourse";

/** How a material was made: its parent or parents and the step that made it. */
export type MaterialFrom = {
  of: string | string[];
  part: Part;
  split?: string;
  step?: Step;
};

/** One authored material, as in a `study.yaml` entry. An unsequenced one is a shadow node: no labels, an optional name. */
export type Material = {
  id: string;
  sequenced: boolean;
  meta: Record<string, string | number>;
  name?: string;
  from?: MaterialFrom;
};

/** The authored design: the editor's state. */
export type Design = {
  materials: Material[];
};

/** A graph node: a material, an inserted pool, or the junction of a separation. Unsequenced nodes are shadow nodes. */
export type GraphNode = {
  id: string;
  kind: "material" | "pool" | "junction";
  sequenced: boolean;
  meta: Record<string, string | number>;
  name?: string;
};

/** A graph edge from a parent to a child. */
export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  part: Part | "pooled";
  split: string | null;
  step: Step | null;
  inserted: boolean;
};

/** The design as nodes and edges (GRAPH.md in the experiment-design spec). */
export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/** The selected node or edge, by id. */
export type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string; to: string }
  | null;
