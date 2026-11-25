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
  /** Trajectories only: what names the last position, and so the comparison. */
  end: [string, string][];
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
  const out: Label = { axes: [], mixed: [], within: [], constant: [], end: [] };
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
  const search = (pool: typeof candidates) => {
    for (let k = 1; k <= pool.length && out.axes.length === 0; k++) {
      for (const S of subsets(pool, k)) {
        const keys = asColumn(S)
          .values.filter((v) => v !== null)
          .map((v) => v.join("\t"));
        if (new Set(keys).size === live.length) out.axes.push(asColumn(S));
      }
    }
  };
  /**
   * A column most of the table leaves blank is an annotation of a few samples, not a factor of the
   * design, and it wins the search by being one column where a real factor takes two: vfp1602's
   * `ladder_fp8v1` marks 4 samples of 20, exactly one gate's lineage, and named that trajectory's
   * positions `0-display, 1-R1, 2-R2` where every sibling read `round + population`. Such a column
   * names positions only where nothing denser can.
   */
  const blank = (col: string) =>
    [...table.values()].filter((row) => (row[col] ?? "") === "").length;
  const dense = candidates.filter((c) => blank(c.col) * 2 <= table.size);
  search(dense);
  if (out.axes.length === 0 && dense.length < candidates.length) search(candidates);
  const used = new Set(out.axes.flatMap((a) => a.cols));
  out.mixed = candidates.filter((c) => !used.has(c.col)).map((c) => asColumn([c]));
  return out;
}

/**
 * Where a trajectory ends, in its own columns: the last position's value for every column the axis
 * and the constants do not already name. Sibling trajectories often share an axis and differ only
 * in a column that is pooled at their start, which `within` drops.
 */
export function endLabel(groups: string[][], table: Table, l: Label): [string, string][] {
  const live = groups.filter((g) => g.length > 0);
  const last = live[live.length - 1];
  if (last === undefined) return [];
  const named = new Set([...l.axes.flatMap((a) => a.cols), ...l.constant.map(([c]) => c)]);
  const out: [string, string][] = [];
  for (const col of Object.keys(table.values().next().value ?? {})) {
    if (named.has(col)) continue;
    const values = new Set(last.map((s) => table.get(s)![col]));
    const [value] = [...values];
    if (values.size === 1 && value !== "") out.push([col, value]);
  }
  return out;
}

/**
 * Every sample an arm holds, from the position it starts at to the ends of the lines running
 * through it.
 *
 * Labelling an arm by its first position alone names it by the step it begins at, which is how an
 * arm of a panning design came to be called "R1": the round column does tell the first positions
 * apart, but it goes on changing inside the arm, so the name says where the arm started rather than
 * what it is. A column that names an arm has to hold still along the whole of it, and `label` already
 * drops a column that varies inside a group, so showing it the whole arm is the entire fix.
 *
 * The trunk before the fork is left out on purpose: every arm shares it, so including it would make
 * the arms disagree on a column they actually agree on.
 */
function armSamples(panel: Panel, trajectories: Position[][]): string[][] {
  const key = (p: Position) => JSON.stringify([...p].sort());
  return Object.values(panel.arms).map((arm) => {
    const starts = new Set(arm.map(key));
    const out = new Set(arm.flat());
    for (const trajectory of trajectories) {
      const from = trajectory.findIndex((p) => starts.has(key(p)));
      if (from < 0) continue;
      for (const position of trajectory.slice(from)) for (const sample of position) out.add(sample);
    }
    return [...out];
  });
}

/**
 * A panel's label, preferring a column that holds still along each arm.
 *
 * Seeing the whole arm is a preference and not a rule, because a column can name the arms well at
 * the point they part and still change later: synthetic-07's three arms are 5, 250 and 1 nM, which
 * is what they are, and the concentration changes again only at arm A's final gate. Demanding
 * constancy there would leave those arms with no name at all. So the whole arm is tried first, and
 * where it names nothing the first positions are used as before.
 */
function panelLabel(panel: Panel, trajectories: Position[][], table: Table): Label {
  const whole = label(armSamples(panel, trajectories), table);
  if (whole.axes.length > 0) return whole;
  return label(
    Object.values(panel.arms).map((a) => a.flat()),
    table,
  );
}

export function labelTensors(t: Tensors, table: Table): Labelled {
  const lab = (tensor: Position[]) => ({ tensor, label: label(tensor, table) });
  // only a trajectory is ordered, so only a trajectory has an end
  const walked = (tensor: Position[]) => {
    const l = label(tensor, table);
    return { tensor, label: { ...l, end: endLabel(tensor, table, l) } };
  };
  return {
    trajectories: t.trajectories.map(walked),
    partitions: t.partitions.map(lab),
    panels: t.panels.map((panel) => ({ panel, label: panelLabel(panel, t.trajectories, table) })),
    recurrences: t.recurrences.map(lab),
  };
}
