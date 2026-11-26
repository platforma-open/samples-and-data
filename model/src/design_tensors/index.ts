// The design tensors Samples & Data publishes: tensor_derivation STEP 2 (structure from the design
// graph) and STEP 3 (labels from the metadata table), as JSON in the shape analysis blocks read
// (spec draft "Each tensor is a JSON object with a fixed shape", schemaVersion 1). Each tensor
// carries its label; splitting labels out to save reruns is left for later.
import type { DSAny, MTColumn, PlId } from "@platforma-open/milaboratories.samples-and-data.kind";
import type { ExperimentDesign } from "../args";
import { designLabel } from "../args";
import { derive, type Graph, type Material } from "./derive";
import {
  endLabel,
  labelTensors,
  type Column,
  type Label,
  type Labelled,
  type Table,
} from "./labels";
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

export type DesignPosition = string[];
export type DesignTrajectory = {
  positions: DesignPosition[];
  /** Per position, the id in `partitions` it is a piece of. */
  pieceOf: (string | null)[];
  /** Per step between positions, what kind of step it is. */
  steps: StepKind[];
};
export type DesignPartition = { positions: DesignPosition[] };
export type DesignPanel = {
  anchor: { material: string; reads: DesignPosition };
  /** Sorted by split name; `trajectories` are ids in `trajectories`. */
  arms: { split: string; positions: DesignPosition[]; trajectories: string[] }[];
};
export type DesignRecurrence = { positions: DesignPosition[] };
/** Everything meant for a reader. Nothing here changes a number, so a rename stops at this section. */
export type DesignLabels = {
  /** Material id -> the name the design gives it, where it has one. */
  materials: Record<string, string>;
  trajectories: Record<string, Label>;
  partitions: Record<string, Label>;
  panels: Record<string, Label>;
  recurrence?: Label;
};
/** One experiment design, the whole of it, as it lives in the result pool. */
export type ExperimentDesignData = {
  schemaVersion: 1;
  trajectories: Record<string, DesignTrajectory>;
  partitions: Record<string, DesignPartition>;
  panels: Record<string, DesignPanel>;
  recurrence: DesignRecurrence | null;
  labels: DesignLabels;
};

/** The spec the design is published under. */
export const DESIGN_OBJECT_NAME = "pl7.app/design";

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

/** Sample ids a dataset holds data for. */
export function datasetSampleIds(dataset: DSAny): string[] {
  const content = dataset.content;
  return "sampleGroups" in content && content.sampleGroups
    ? Object.values(content.sampleGroups).flatMap((group) => Object.keys(group))
    : Object.keys(content.data);
}

/**
 * The dataset a design applies to and the samples it holds. One dataset, always: the one the
 * design picks, else the first. Each dataset is clonotyped on its own, so a design reaching across
 * two of them names positions that no analysis block can bring into one table, and the design is
 * simply not offered there. Scoping it here is what keeps that from being possible to build.
 *
 * A block with no datasets at all is the one exception: every sample stays in scope, so a design
 * drawn before any data arrives still reads.
 */
export function designScope(
  design: Pick<ExperimentDesign, "datasetIds">,
  source: Pick<DesignSource, "sampleIds" | "datasets">,
): { datasets: DSAny[]; sampleIds: Set<string> } {
  if (source.datasets.length === 0) return { datasets: [], sampleIds: new Set(source.sampleIds) };
  const picked = source.datasets.filter((dataset) => design.datasetIds?.includes(dataset.id));
  const scope = (picked.length > 0 ? picked : source.datasets).slice(0, 1);
  const held = new Set(scope.flatMap(datasetSampleIds));
  return { datasets: scope, sampleIds: new Set(source.sampleIds.filter((id) => held.has(id))) };
}

export type DerivedDesign = {
  designId: string;
  designName: string;
  tensors: Tensors;
  labelled: Labelled;
  json: Record<string, TensorJson>;
  /** The same tensors as one object, which is what the block publishes. */
  design: ExperimentDesignData;
};

/** Derives one design's tensors and labels. Throws when the graph is not a valid design. */
export function deriveDesign(
  design: ExperimentDesign,
  index: number,
  source: DesignSource,
): DerivedDesign {
  const scope = designScope(design, source);
  const present = scope.sampleIds;
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
  const table = metadataTable(source);
  const labelled = labelTensors(tensors, table);
  const designName = designLabel(design, index);
  const names = new Map(design.materials.map((material) => [material.id, material.name]));
  const ids = tensorIds(tensors);
  const labels = labelsById(labelled, table, ids);
  const base = (id: string): Base => ({
    schemaVersion: 1,
    designName,
    datasets: scope.datasets.map((dataset) => dataset.id),
    label: labels[id]!,
  });
  const json = toJson(graph, tensors, ids, base, names);
  return {
    designId: design.id,
    designName,
    tensors,
    labelled,
    json,
    design: toDesign(json, ids, names),
  };
}

const key = (p: string[]) => JSON.stringify([...p].sort());

/**
 * A tensor's id, built from the materials it is made of rather than its place in derivation order,
 * so adding or removing a branch elsewhere in the design leaves it alone. A trajectory is named by
 * where it ends, a panel by its anchor, a partition by what it holds.
 *
 * Two limits, both deliberate. A candidate that is blank or already taken falls back to the running
 * number, because nothing guarantees uniqueness in general: across the 39-study corpus every
 * trajectory and panel got its own, while partitions of unsequenced material can read alike. And no
 * id survives every edit, since extending a trajectory renames it; a block that finds its saved
 * tensor gone should say so rather than trust the id to hold.
 */
function tensorIds(t: Tensors): {
  trajectories: string[];
  partitions: string[];
  panels: string[];
  recurrences: string[];
} {
  const taken = new Set<string>();
  const pick = (candidate: string, fallback: string): string => {
    const id = candidate !== "" && !taken.has(candidate) ? candidate : fallback;
    taken.add(id);
    return id;
  };
  const join = (positions: string[][]) =>
    positions
      .map((p) => [...p].sort().join("+"))
      .filter((p) => p !== "")
      .join("|");
  return {
    partitions: t.partitions.map((positions, i) => pick(join(positions), `partition-${i + 1}`)),
    trajectories: t.trajectories.map((positions, i) =>
      pick(join(positions.slice(-1)), `trajectory-${i + 1}`),
    ),
    panels: t.panels.map((p, i) => pick(p.anchor, `panel-${i + 1}`)),
    recurrences: t.recurrences.map((_, i) => pick(`recurrence`, `recurrence-${i + 1}`)),
  };
}

/** Tensor ids are the type and its number in derivation order: `trajectory-1`, `panel-1`. */
function toJson(
  g: Graph,
  t: Tensors,
  ids: ReturnType<typeof tensorIds>,
  base: (id: string) => Base,
  names: Map<string, string | undefined>,
): Record<string, TensorJson> {
  const out: Record<string, TensorJson> = {};

  // partitions first: trajectories point at them
  const partitionOf = new Map<string, string>();
  t.partitions.forEach((positions, i) => {
    const id = ids.partitions[i]!;
    out[id] = { ...base(id), type: "partition", positions };
    for (const p of positions) if (p.length) partitionOf.set(key(p), id);
  });

  const trajectoryIds: { id: string; positions: string[][] }[] = [];
  t.trajectories.forEach((positions, i) => {
    const id = ids.trajectories[i]!;
    const pieceOf = positions.map((p) => partitionOf.get(key(p)) ?? null);
    const steps: StepKind[] = [];
    for (let k = 1; k < positions.length; k++)
      steps.push(stepKind(g, positions[k - 1]!, positions[k]!, pieceOf[k] !== null));
    out[id] = { ...base(id), type: "trajectory", positions, pieceOf, steps };
    trajectoryIds.push({ id, positions });
  });

  t.panels.forEach((p, i) => {
    const id = ids.panels[i]!;
    const arms = Object.entries(p.arms)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([split, positions]) => {
        const keys = new Set(positions.filter((x) => x.length).map(key));
        const trajectories = trajectoryIds
          .filter((tr) => tr.positions.some((x) => keys.has(key(x))))
          .map((tr) => tr.id);
        return { split, positions, trajectories };
      });
    out[id] = {
      ...base(id),
      type: "panel",
      anchor: { material: names.get(p.anchor) ?? p.anchor, reads: p.reads },
      arms,
    };
  });

  t.recurrences.forEach((positions, i) => {
    const id = ids.recurrences[i]!;
    out[id] = { ...base(id), type: "recurrence", positions };
  });
  return out;
}

/**
 * The design as one object for the result pool: four sections by type, and every name in `labels`.
 * A reference says which section it points into, so nothing has to read a type out of an id, and a
 * rename touches `labels` alone.
 */
export function toDesign(
  json: Record<string, TensorJson>,
  ids: ReturnType<typeof tensorIds>,
  materials: Map<string, string | undefined>,
): ExperimentDesignData {
  const out: ExperimentDesignData = {
    schemaVersion: 1,
    trajectories: {},
    partitions: {},
    panels: {},
    recurrence: null,
    labels: { materials: {}, trajectories: {}, partitions: {}, panels: {} },
  };
  for (const [id, tensor] of Object.entries(json)) {
    if (tensor.type === "trajectory") {
      const { positions, steps, pieceOf } = tensor;
      out.trajectories[id] = { positions, steps, pieceOf };
      out.labels.trajectories[id] = tensor.label;
    } else if (tensor.type === "partition") {
      out.partitions[id] = { positions: tensor.positions };
      out.labels.partitions[id] = tensor.label;
    } else if (tensor.type === "panel") {
      // the anchor is the material id here; its name is in `labels.materials`
      const anchor = ids.panels.includes(id) ? id : tensor.anchor.material;
      out.panels[id] = {
        anchor: { material: anchor, reads: tensor.anchor.reads },
        arms: tensor.arms,
      };
      out.labels.panels[id] = tensor.label;
    } else {
      out.recurrence = { positions: tensor.positions };
      out.labels.recurrence = tensor.label;
    }
  }
  for (const [id, name] of materials)
    if (name !== undefined && name !== id) out.labels.materials[id] = name;
  return out;
}

/**
 * The one axis a tensor is published with. STEP 3 keeps every smallest set of columns that tells
 * the groups apart, and a table often has several; the fewest blank cells wins, since a blank
 * means "this step had not happened yet" and names nothing. Ties keep the earlier set.
 */
export function oneAxis(label: Label): Label {
  if (label.axes.length < 2) return label;
  const blanks = (axis: Column) =>
    axis.values.reduce((n, cells) => n + (cells?.filter((cell) => cell === "").length ?? 0), 0);
  return { ...label, axes: [label.axes.reduce((a, b) => (blanks(b) < blanks(a) ? b : a))] };
}

/** Labels by tensor id, with the same ids and group order as toJson. */
function labelsById(
  l: Labelled,
  table: Table,
  ids: ReturnType<typeof tensorIds>,
): Record<string, Label> {
  const out: Record<string, Label> = {};
  const put = (id: string, label: Label) => (out[id] = oneAxis(label));
  l.partitions.forEach((x, i) => put(ids.partitions[i]!, x.label));
  // the end point is read again against the one axis published, so the columns dropped with the
  // other axes still name it
  l.trajectories.forEach((x, i) => {
    const label = oneAxis(x.label);
    out[ids.trajectories[i]!] = { ...label, end: endLabel(x.tensor, table, label) };
  });
  l.panels.forEach((x, i) => {
    // toJson sorts arms by split name; labels follow the derivation's arm order
    const splits = Object.keys(x.panel.arms);
    const order = [...splits].sort((a, b) => a.localeCompare(b)).map((s) => splits.indexOf(s));
    const reorder = (c: Column): Column => ({
      cols: c.cols,
      values: order.map((k) => c.values[k]!),
    });
    put(ids.panels[i]!, {
      ...x.label,
      axes: x.label.axes.map(reorder),
      mixed: x.label.mixed.map(reorder),
    });
  });
  l.recurrences.forEach((x, i) => put(ids.recurrences[i]!, x.label));
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

/** Every design's tensors as column cells. A design that cannot be derived is left out. */
/** One design, ready to publish: the object plus what the pool needs to show it. */
export type DesignObject = {
  id: string;
  /** Becomes pl7.app/label on the object's spec. */
  label: string;
  /** Every sample the design names, so a block can tell which data covers it. */
  samples: string[];
  data: ExperimentDesignData;
};

/**
 * The designs this block publishes, one object each. A design that holds nothing, or whose graph is
 * not a valid design, is left out rather than published broken.
 */
export function designObjects(designs: ExperimentDesign[], source: DesignSource): DesignObject[] {
  const out: DesignObject[] = [];
  designs.forEach((design, index) => {
    if (design.materials.length === 0) return;
    let derived: DerivedDesign;
    try {
      derived = deriveDesign(design, index, source);
    } catch {
      return;
    }
    const samples = new Set<string>();
    for (const tensor of Object.values(derived.json)) {
      const positions =
        tensor.type === "panel"
          ? [...tensor.arms.flatMap((arm) => arm.positions), tensor.anchor.reads]
          : tensor.positions;
      for (const position of positions) for (const sample of position) samples.add(sample);
    }
    out.push({
      id: design.id,
      label: derived.designName,
      samples: [...samples].sort(),
      data: derived.design,
    });
  });
  return out;
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
  /** Columns that change inside the tensor without telling its groups apart, `Antigen = FP8v1`. */
  varies: string[];
  /** Trajectories only: what names the last position, `Replicate = 1`. */
  endpoint: string[];
  /** Trajectories only: the panel arms it runs through, named as the panel names them. */
  arms: string[];
  /** The same arms with their panel, since two panels can name an arm alike (VH and VL). */
  armKeys: string[];
  /** Sample ids in the tensor, a panel's anchor included, for highlighting it in the graph. */
  members: string[];
};

/** What the label calls group `k`, from every axis it has. */
function groupName(label: Label, k: number): string {
  return label.axes
    .map((axis) => axis.values[k]?.filter((cell) => cell !== "").join(" · ") ?? "")
    .filter((value) => value !== "")
    .join(" · ");
}

/** The arms each trajectory runs through, so comparisons of one arm list together. */
function armsByTrajectory(
  json: Record<string, TensorJson>,
): Map<string, { name: string; key: string }[]> {
  const out = new Map<string, { name: string; key: string }[]>();
  for (const [panelId, tensor] of Object.entries(json)) {
    if (tensor.type !== "panel") continue;
    tensor.arms.forEach((arm, k) => {
      const name = groupName(tensor.label, k) || arm.split;
      const found = { name, key: `${panelId}/${arm.split}` };
      for (const id of arm.trajectories) out.set(id, [...(out.get(id) ?? []), found]);
    });
  }
  return out;
}

/** The design's tensors for the viewer, with sample labels for sample ids. */
export function designTensorRows(
  derived: DerivedDesign,
  sampleLabels: Record<string, string>,
): TensorRow[] {
  const arms = armsByTrajectory(derived.json);
  return Object.entries(derived.json).map(([id, tensor]) => {
    const label = tensor.label;
    const members =
      tensor.type === "panel" ? tensor.arms.map((arm) => arm.positions.flat()) : tensor.positions;
    const groups = members.map((samples, k) => {
      const samplesShown = samples.map((sample) => sampleLabels[sample] ?? sample);
      const name = groupName(label, k);
      return { name: name || samplesShown.join(", ") || "(not sequenced)", samples: samplesShown };
    });
    return {
      id,
      type: tensor.type,
      by: label.axes.map((axis) => axis.cols.join("+")).join(", "),
      groups,
      constant: label.constant.map(([column, value]) => `${column} = ${value}`),
      // what sets sibling tensors of the same shape apart, once the axis is one set of columns
      varies: label.mixed.map((axis) => {
        const values = [
          ...new Set(axis.values.flatMap((cells) => cells ?? []).filter((cell) => cell !== "")),
        ];
        return `${axis.cols.join("+")} = ${values.join(" · ")}`;
      }),
      endpoint: label.end.map(([column, value]) => `${column} = ${value}`),
      arms: (arms.get(id) ?? []).map((arm) => arm.name),
      armKeys: (arms.get(id) ?? []).map((arm) => arm.key),
      members: [...(tensor.type === "panel" ? tensor.anchor.reads : []), ...members.flat()],
    };
  });
}
