// The design tensors Samples & Data publishes: tensor_derivation STEP 2 (structure from the design
// graph) and STEP 3 (labels from the metadata table), as JSON in the shape analysis blocks read
// (spec draft "Each tensor is a JSON object with a fixed shape", schemaVersion 1). Each tensor
// carries its label; splitting labels out to save reruns is left for later.
import type { DSAny, MTColumn, PlId } from "@platforma-open/milaboratories.samples-and-data.kind";
import type { ExperimentDesign } from "../args";
import { designLabel } from "../args";
import { derive, type Graph, type Material } from "./derive";
import { labelTensors, type Column, type Label, type Labelled, type Table } from "./labels";
import { inferTensors, type Tensors } from "./tensors";

export const TENSOR_COLUMN_NAME = "pl7.app/design/tensors";

export type StepKind = "selection" | "piece" | "portion" | "timecourse";
type Base = {
  schemaVersion: 1;
  designName: string;
  datasets: string[];
  /** STEP 3 label, its values in the same group order as the tensor. */
  label: Label;
};
export type TensorJson =
  | (Base & {
      type: "trajectory";
      positions: string[][];
      /** Per position, the id of the partition it is a piece of. */
      pieceOf: (string | null)[];
      /** Per step between positions, what kind of step it is. */
      steps: StepKind[];
    })
  | (Base & { type: "partition" | "recurrence"; positions: string[][] })
  | (Base & {
      type: "panel";
      anchor: { material: string; reads: string[] };
      /** Sorted by split name; `trajectories` are the ids of the trajectories through each arm. */
      arms: { split: string; positions: string[][]; trajectories: string[] }[];
    });

/** The block data the derivation reads. */
export type DesignSource = {
  sampleIds: PlId[];
  sampleLabels: Record<PlId, string>;
  metadata: MTColumn[];
  datasets: DSAny[];
};

/** Metadata column names as the design tools show them: trimmed, unnamed and repeated ones told apart. */
export function columnNames(columns: MTColumn[]): string[] {
  const base = columns.map((column) =>
    column.label.trim() === "" ? "Unnamed column" : column.label.trim(),
  );
  return base.map((name, index) => {
    const repeat = base.slice(0, index).filter((other) => other === name).length;
    return repeat === 0 ? name : `${name} (${repeat + 1})`;
  });
}

/** The metadata as STEP 3 reads it: sample id -> column -> value, '' when blank. */
function metadataTable(source: DesignSource): Table {
  const names = columnNames(source.metadata);
  return new Map(
    source.sampleIds.map((id) => [
      id,
      Object.fromEntries(
        source.metadata.map((column, index) => [names[index]!, String(column.data[id] ?? "")]),
      ),
    ]),
  );
}

export type DerivedDesign = {
  designId: string;
  designName: string;
  tensors: Tensors;
  labelled: Labelled;
  json: Record<string, TensorJson>;
};

/** Derives one design's tensors and labels. Throws when the graph is not a valid design. */
export function deriveDesign(
  design: ExperimentDesign,
  index: number,
  source: DesignSource,
): DerivedDesign {
  const present = new Set<string>(source.sampleIds);
  const materials: Record<string, Material> = Object.fromEntries(
    design.materials.map((material) => [material.id, material.from ? { from: material.from } : {}]),
  );
  const sequenced = new Set(
    design.materials
      .filter((material) => material.sequenced && present.has(material.id))
      .map((material) => material.id),
  );
  const graph = derive(materials, sequenced);
  const tensors = inferTensors(graph);
  const labelled = labelTensors(tensors, metadataTable(source));
  const designName = designLabel(design, index);
  const names = new Map(design.materials.map((material) => [material.id, material.name]));
  const labels = labelsById(labelled);
  const base = (id: string): Base => ({
    schemaVersion: 1,
    designName,
    datasets: source.datasets.map((dataset) => dataset.id),
    label: labels[id]!,
  });
  return {
    designId: design.id,
    designName,
    tensors,
    labelled,
    json: toJson(graph, tensors, base, names),
  };
}

const key = (p: string[]) => JSON.stringify([...p].sort());

/** Tensor ids are the type and its number in derivation order: `trajectory-1`, `panel-1`. */
function toJson(
  g: Graph,
  t: Tensors,
  base: (id: string) => Base,
  names: Map<string, string | undefined>,
): Record<string, TensorJson> {
  const out: Record<string, TensorJson> = {};

  // partitions first: trajectories point at them
  const partitionOf = new Map<string, string>();
  t.partitions.forEach((positions, i) => {
    const id = `partition-${i + 1}`;
    out[id] = { ...base(id), type: "partition", positions };
    for (const p of positions) if (p.length) partitionOf.set(key(p), id);
  });

  const trajectoryIds: { id: string; positions: string[][] }[] = [];
  t.trajectories.forEach((positions, i) => {
    const id = `trajectory-${i + 1}`;
    const pieceOf = positions.map((p) => partitionOf.get(key(p)) ?? null);
    const steps: StepKind[] = [];
    for (let k = 1; k < positions.length; k++)
      steps.push(stepKind(g, positions[k - 1]!, positions[k]!, pieceOf[k] !== null));
    out[id] = { ...base(id), type: "trajectory", positions, pieceOf, steps };
    trajectoryIds.push({ id, positions });
  });

  t.panels.forEach((p, i) => {
    const arms = Object.entries(p.arms)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([split, positions]) => {
        const keys = new Set(positions.filter((x) => x.length).map(key));
        const trajectories = trajectoryIds
          .filter((tr) => tr.positions.some((x) => keys.has(key(x))))
          .map((tr) => tr.id);
        return { split, positions, trajectories };
      });
    out[`panel-${i + 1}`] = {
      ...base(`panel-${i + 1}`),
      type: "panel",
      anchor: { material: names.get(p.anchor) ?? p.anchor, reads: p.reads },
      arms,
    };
  });

  t.recurrences.forEach((positions, i) => {
    out[`recurrence-${i + 1}`] = {
      ...base(`recurrence-${i + 1}`),
      type: "recurrence",
      positions,
    };
  });
  return out;
}

/** Labels by tensor id, with the same ids and group order as toJson. */
function labelsById(l: Labelled): Record<string, Label> {
  const out: Record<string, Label> = {};
  const put = (id: string, label: Label) => (out[id] = label);
  l.partitions.forEach((x, i) => put(`partition-${i + 1}`, x.label));
  l.trajectories.forEach((x, i) => put(`trajectory-${i + 1}`, x.label));
  l.panels.forEach((x, i) => {
    // toJson sorts arms by split name; labels follow the derivation's arm order
    const splits = Object.keys(x.panel.arms);
    const order = [...splits].sort((a, b) => a.localeCompare(b)).map((s) => splits.indexOf(s));
    const reorder = (c: Column): Column => ({
      cols: c.cols,
      values: order.map((k) => c.values[k]!),
    });
    put(`panel-${i + 1}`, {
      ...x.label,
      axes: x.label.axes.map(reorder),
      mixed: x.label.mixed.map(reorder),
    });
  });
  l.recurrences.forEach((x, i) => put(`recurrence-${i + 1}`, x.label));
  return out;
}

/** Kind of the step from position `a` to position `b`, read from the edges between them. */
function stepKind(g: Graph, a: string[], b: string[], bIsPiece: boolean): StepKind {
  const target = new Set(a.flatMap((m) => g.class_of[m] ?? [m]));
  const edges: { part: string; step?: string }[] = [];
  let n = b[0]!;
  for (let guard = 0; guard < 1000 && !target.has(n); guard++) {
    const ps = g.parents[n];
    if (!ps || ps.length === 0) break;
    edges.push(g.edge(ps[0]!, n));
    n = ps[0]!;
  }
  if (edges.some((e) => e.step === "timecourse")) return "timecourse";
  if (bIsPiece) return "piece";
  if (edges.length > 0 && edges.every((e) => e.part === "whole")) return "portion";
  return "selection";
}

/** Cells of the tensor column: JSON key [designId, tensorId] -> JSON value. */
export type DesignTensorCells = {
  tensors: Record<string, string>;
};

/** Every design's tensors as column cells. A design that cannot be derived is left out. */
export function designTensorCells(
  designs: ExperimentDesign[],
  source: DesignSource,
): DesignTensorCells {
  const cells: DesignTensorCells = { tensors: {} };
  designs.forEach((design, index) => {
    if (design.materials.length === 0) return;
    let derived: DerivedDesign;
    try {
      derived = deriveDesign(design, index, source);
    } catch {
      return;
    }
    for (const [tensorId, tensor] of Object.entries(derived.json))
      cells.tensors[JSON.stringify([design.id, tensorId])] = JSON.stringify(tensor);
  });
  return cells;
}

/** One tensor as the viewer lists it: its groups in order, named by their labels. */
export type TensorRow = {
  id: string;
  type: TensorJson["type"];
  /** The label columns the groups differ by, `Round` or `Antigen+Arm`; empty when none. */
  by: string;
  /** Per group (position, or panel arm): its name and the sample labels in it. */
  groups: { name: string; samples: string[] }[];
  /** Columns with one value across the whole tensor, `Antigen = A1`. */
  constant: string[];
  /** Sample ids in the tensor, a panel's anchor included, for highlighting it in the graph. */
  members: string[];
};

/** The design's tensors for the viewer, with sample labels for sample ids. */
export function designTensorRows(
  derived: DerivedDesign,
  sampleLabels: Record<string, string>,
): TensorRow[] {
  return Object.entries(derived.json).map(([id, tensor]) => {
    const label = tensor.label;
    const members =
      tensor.type === "panel" ? tensor.arms.map((arm) => arm.positions.flat()) : tensor.positions;
    const groups = members.map((samples, k) => {
      const samplesShown = samples.map((sample) => sampleLabels[sample] ?? sample);
      const name = label.axes
        .map((axis) => axis.values[k]?.filter((cell) => cell !== "").join(" · ") ?? "")
        .filter((value) => value !== "")
        .join(" · ");
      return { name: name || samplesShown.join(", ") || "(not sequenced)", samples: samplesShown };
    });
    return {
      id,
      type: tensor.type,
      by: label.axes.map((axis) => axis.cols.join("+")).join(", "),
      groups,
      constant: label.constant.map(([column, value]) => `${column} = ${value}`),
      members: [...(tensor.type === "panel" ? tensor.anchor.reads : []), ...members.flat()],
    };
  });
}
