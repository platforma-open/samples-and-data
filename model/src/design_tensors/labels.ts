// Copied from tensor_derivation (src/labels.ts at 9492e67). Only import paths changed.
// STEP 3: label tensors. See LABELS.md.
// Reads only the tensors and metadata.tsv; never the graph or study.yaml.
import type { Panel, Position, Tensors } from "./tensors";

export type Table = Map<string, Record<string, string>>; // sampleId -> column -> value ('' if blank)
export interface Column {
  cols: string[];
  values: (string[] | null)[];
} // one tuple per group; null is a hole
export interface Label {
  axes: Column[];
  mixed: Column[];
  within: string[];
  constant: [string, string][];
}
export interface Labelled {
  trajectories: { tensor: Position[]; label: Label }[];
  partitions: { tensor: Position[]; label: Label }[];
  panels: { panel: Panel; label: Label }[];
  recurrences: { tensor: Position[]; label: Label }[];
}

// every k-subset of xs, in order
function* subsets<T>(xs: T[], k: number, start = 0): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = start; i <= xs.length - k; i++)
    for (const rest of subsets(xs, k - 1, i + 1)) yield [xs[i]!, ...rest];
}

export function label(groups: string[][], table: Table): Label {
  const columns = Object.keys(table.values().next().value ?? {});
  const live = groups.filter((g) => g.length > 0);
  const out: Label = { axes: [], mixed: [], within: [], constant: [] };
  const candidates: { col: string; values: (string | null)[] }[] = [];
  for (const col of columns) {
    const per = live.map((g) => new Set(g.map((s) => table.get(s)![col])));
    if (per.some((s) => s.size > 1)) {
      out.within.push(col);
      continue;
    }
    const one = per.map((s) => [...s][0]);
    if (new Set(one).size === 1) {
      if (one[0] !== "") out.constant.push([col, one[0]!]);
      continue;
    }
    candidates.push({
      col,
      values: groups.map((g) => (g.length > 0 ? table.get(g[0]!)![col]! : null)),
    });
  }

  // ponytail: tries every subset, fine for the handful of columns a sample table has
  const asColumn = (S: typeof candidates): Column => ({
    cols: S.map((c) => c.col),
    values: groups.map((g, i) => (g.length > 0 ? S.map((c) => c.values[i]!) : null)),
  });
  for (let k = 1; k <= candidates.length && out.axes.length === 0; k++) {
    for (const S of subsets(candidates, k)) {
      const keys = asColumn(S)
        .values.filter((v) => v !== null)
        .map((v) => v.join("\t"));
      if (new Set(keys).size === live.length) out.axes.push(asColumn(S));
    }
  }
  const used = new Set(out.axes.flatMap((a) => a.cols));
  out.mixed = candidates.filter((c) => !used.has(c.col)).map((c) => asColumn([c]));
  return out;
}

export function labelTensors(t: Tensors, table: Table): Labelled {
  const lab = (tensor: Position[]) => ({ tensor, label: label(tensor, table) });
  return {
    trajectories: t.trajectories.map(lab),
    partitions: t.partitions.map(lab),
    panels: t.panels.map((panel) => ({
      panel,
      label: label(
        Object.values(panel.arms).map((a) => a.flat()),
        table,
      ),
    })),
    recurrences: t.recurrences.map(lab),
  };
}
