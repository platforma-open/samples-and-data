import { connect, disconnect, findMaterial, joinSeparation, reparent, setStep } from "./edit";
import { junctionOf } from "./junctions";
import { parentsOf } from "./toGraph";
import type { Design, Graph, Part } from "./types";

/** A port side: `out` adds children, `in` adds parents. */
export type PortSide = "in" | "out";

/** What the user drags: a node's port, or one end of an edge. */
export type DragSource =
  | { kind: "port"; nodeId: string; side: PortSide }
  | { kind: "end"; edgeId: string; end: "parent" | "child" };

/** Where the drag ends. */
export type DropTarget =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | { kind: "empty" };

/** The outcome of a drop: a new design, or the sample picker for a port. */
export type DropResult = { design: Design } | { picker: { nodeId: string; side: PortSide } };

/** The parent and child materials an edge stands for, when its ends can be reconnected. */
export function logicalEdge(graph: Graph, edgeId: string) {
  const edge = graph.edges.find((item) => item.id === edgeId);
  const kind = (id: string) => graph.nodes.find((node) => node.id === id)?.kind;
  if (edge === undefined || kind(edge.to) === "junction" || kind(edge.from) === "pool") {
    return undefined;
  }
  const parentId =
    kind(edge.from) === "junction"
      ? graph.edges.find((item) => item.to === edge.from)!.from
      : edge.from;
  const childId =
    kind(edge.to) === "pool" ? graph.edges.find((item) => item.from === edge.to)!.to : edge.to;
  return { parentId, childId };
}

function joinTarget(design: Design, graph: Graph, childId: string, target: DropTarget) {
  if (target.kind === "empty") {
    return undefined;
  }
  const targetEdge = graph.edges.find((edge) => target.kind === "edge" && edge.id === target.id);
  const junction = junctionOf(graph, target.kind === "node" ? target.id : targetEdge?.to);
  if (junction !== undefined) {
    return joinSeparation(design, childId, junction.parentId, junction.partitions[0]);
  }
  const edge = logicalEdge(graph, target.id);
  if (target.kind === "node" || edge === undefined) {
    return undefined;
  }
  return joinSeparation(design, childId, edge.parentId, edge.childId);
}

const parentsOfMaterial = (design: Design, id: string) => {
  const from = findMaterial(design, id)?.from;
  if (from === undefined) {
    return [];
  }
  return parentsOf(from);
};

function moveChildEnd(
  design: Design,
  parentId: string,
  childId: string,
  newChildId: string,
  part: Part,
) {
  const from = findMaterial(design, childId)?.from;
  if (from === undefined) {
    return undefined;
  }
  const merged = parentsOf(from).length > 1;
  const moved = disconnect(design, parentId, childId);
  const connected = connect(moved, parentId, newChildId, merged ? part : from.part);
  if (
    connected === undefined ||
    merged ||
    from.step === undefined ||
    parentsOfMaterial(connected, newChildId).length > 1
  ) {
    return connected;
  }
  return setStep(connected, newChildId, from.step);
}

/** What dropping `source` on `target` does; undefined when the drop is refused or changes nothing. `part` applies to new connections only. */
export function planDrop(
  design: Design,
  graph: Graph,
  source: DragSource,
  target: DropTarget,
  part: Part,
): DropResult | undefined {
  const plan = planChange(design, graph, source, target, part);
  if (
    plan === undefined ||
    ("design" in plan && JSON.stringify(plan.design) === JSON.stringify(design))
  ) {
    return undefined;
  }
  return plan;
}

const asResult = (next: Design | undefined): DropResult | undefined => {
  if (next === undefined) {
    return undefined;
  }
  return { design: next };
};

function planChange(
  design: Design,
  graph: Graph,
  source: DragSource,
  target: DropTarget,
  part: Part,
): DropResult | undefined {
  const node = graph.nodes.find((item) => target.kind === "node" && item.id === target.id);
  const isMaterial = node?.kind === "material";

  if (source.kind === "port") {
    if (target.kind === "empty") {
      return { picker: { nodeId: source.nodeId, side: source.side } };
    }
    if (source.side === "out") {
      if (node?.kind === "pool") {
        const child = graph.edges.find((edge) => edge.from === node.id)!.to;
        return asResult(connect(design, source.nodeId, child, part));
      }
      if (!isMaterial) {
        return undefined;
      }
      return asResult(connect(design, source.nodeId, node.id, part));
    }
    if (isMaterial) {
      return asResult(connect(design, node.id, source.nodeId, part));
    }
    if (parentsOfMaterial(design, source.nodeId).length > 0) {
      return undefined;
    }
    return asResult(joinTarget(design, graph, source.nodeId, target));
  }

  const edge = logicalEdge(graph, source.edgeId);
  if (edge === undefined || target.kind === "empty") {
    return undefined;
  }
  if (source.end === "child") {
    if (!isMaterial || node.id === edge.childId) {
      return undefined;
    }
    return asResult(moveChildEnd(design, edge.parentId, edge.childId, node.id, part));
  }
  if (isMaterial) {
    return asResult(reparent(design, edge.childId, edge.parentId, node.id));
  }
  if (parentsOfMaterial(design, edge.childId).length > 1) {
    return undefined;
  }
  return asResult(joinTarget(design, graph, edge.childId, target));
}
