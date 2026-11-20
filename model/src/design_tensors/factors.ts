// Copied from tensor_derivation (src/factors.ts at 9492e67). Only import paths changed.
// STEP 4: lay out trajectories that share a start as one table, rows named by factors.
// See FACTORS.md. Reads only the labelled tensors and metadata.tsv. Layout only: no new claims.
import type { Position } from "./tensors";
import { label, type Labelled, type Table } from "./labels";

export interface Fork {
  at: string;
  factors: string[];
  confounded: boolean;
} // at: "(reads)" or "{anchor: X}"
export interface Row {
  factors: [string, string][];
  cells: (Position | null)[];
}
export interface Factored {
  axis: string[];
  values: string[][];
  forks: Fork[];
  rows: Row[];
}

const key = (p: Position) => p.join(", ");
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

// values ordered so every chain reads left to right; ties in natural order. null on a cycle.
function order(chains: string[][]): string[] | null {
  const after = new Map<string, Set<string>>();
  const before = new Map<string, number>();
  for (const c of chains)
    for (const v of c) {
      after.set(v, after.get(v) ?? new Set());
      before.set(v, before.get(v) ?? 0);
    }
  for (const c of chains)
    for (let i = 1; i < c.length; i++) {
      if (!after.get(c[i - 1]!)!.has(c[i]!)) {
        after.get(c[i - 1]!)!.add(c[i]!);
        before.set(c[i]!, before.get(c[i]!)! + 1);
      }
    }
  const out: string[] = [];
  let ready = [...before].filter(([, n]) => n === 0).map(([v]) => v);
  while (ready.length > 0) {
    const v = ready.sort(natural).shift()!;
    out.push(v);
    for (const w of after.get(v)!) {
      before.set(w, before.get(w)! - 1);
      if (before.get(w) === 0) ready.push(w);
    }
  }
  return out.length === before.size ? out : null;
}

export function factorTrajectories(l: Labelled, table: Table): Factored[] {
  // 1. trajectories that share a start: one first position, or first positions in arms of one panel
  const anchorOf = new Map<string, string>(); // start -> panel anchor, for a fork before the first position
  const groups = new Map<string, Position[][]>();
  const axesOf = new Map<Position[], string[]>();
  for (const { tensor, label: lab } of l.trajectories) {
    const first = key(tensor[0]!);
    const panel = l.panels.find((p) =>
      Object.values(p.panel.arms).some((arm) => arm.some((q) => key(q) === first)),
    );
    const start = panel ? `panel ${l.panels.indexOf(panel)}` : first;
    if (panel) anchorOf.set(start, panel.panel.anchor);
    groups.set(start, [...(groups.get(start) ?? []), tensor]);
    axesOf.set(
      tensor,
      lab.axes.map((a) => a.cols.join("+")),
    );
  }

  const out: Factored[] = [];
  for (const [start, members] of groups) {
    // 2. within a group, trajectories that share an axis
    const subgroups: { choices: string[]; ts: Position[][] }[] = [];
    for (const t of members) {
      const mine = axesOf.get(t)!;
      const s = subgroups.find((s) => s.choices.some((c) => mine.includes(c)));
      if (s) {
        s.choices = s.choices.filter((c) => mine.includes(c));
        s.ts.push(t);
      } else subgroups.push({ choices: mine, ts: [t] });
    }
    for (const s of subgroups) {
      const axis = s.choices[0]?.split("+") ?? [];
      const vkey = (p: Position) => axis.map((c) => table.get(p[0]!)![c] ?? "").join("\t");
      // 3. columns; with no axis or no single order, each trajectory stands alone
      const ord = axis.length > 0 ? order(s.ts.map((t) => t.map(vkey))) : null;
      if (ord === null && s.ts.length > 1) {
        for (const t of s.ts) out.push(layout([t], [], null, start));
        continue;
      }
      out.push(layout(s.ts, axis, ord, start));
    }
  }
  return out;

  function layout(ts: Position[][], axis: string[], ord: string[] | null, start: string): Factored {
    const vkey = (p: Position) => axis.map((c) => table.get(p[0]!)![c] ?? "").join("\t");
    const cols = ord ?? ts[0]!.map((_, i) => String(i)); // no axis: one column per position
    const rows: Row[] = ts.map((t) => ({
      factors: [],
      cells: cols.map((v, i) => (ord ? (t.find((p) => vkey(p) === v) ?? null) : (t[i] ?? null))),
    }));
    const forks: Fork[] = [];

    // 4. factors: at each fork, the columns that tell the branches apart
    const split = (idx: number[], depth: number): void => {
      if (idx.every((i) => depth >= ts[i]!.length)) return;
      const branches = new Map<string, number[]>();
      for (const i of idx) {
        const k = ts[i]![depth] ? key(ts[i]![depth]!) : "";
        branches.set(k, [...(branches.get(k) ?? []), i]);
      }
      if (branches.size === 1) {
        split(idx, depth + 1);
        return;
      }
      // a branch runs from depth down to where its rows split again
      const ends = [...branches.values()].map((b) => {
        let e = depth + 1;
        while (b.every((i) => ts[i]![e]) && new Set(b.map((i) => key(ts[i]![e]!))).size === 1) e++;
        return e;
      });
      const segments = [...branches.values()].map((b, j) =>
        ts[b[0]!]!.slice(depth, ends[j]).flat(),
      );
      const lab = label(segments, table);
      const axes = lab.axes.filter((a) => !a.cols.some((c) => axis.includes(c)));
      const varying = new Set([...axes, ...lab.mixed].flatMap((c) => c.cols));
      const factors = Object.keys(table.values().next().value ?? {}).filter(
        (c) => varying.has(c) && !axis.includes(c),
      );
      const at =
        depth > 0
          ? `(${key(ts[idx[0]!]![depth - 1]!)})`
          : `{anchor: ${anchorOf.get(start) ?? "?"}}`;
      forks.push({ at, factors, confounded: axes.length > 1 });
      [...branches.values()].forEach((b, j) => {
        for (const i of b)
          for (const f of factors)
            rows[i]!.factors.push([f, table.get(segments[j]![0]!)![f] ?? ""]);
        if (b.length > 1) split(b, ends[j]!);
      });
    };
    split(
      ts.map((_, i) => i),
      0,
    );

    return { axis, values: ord ? ord.map((v) => v.split("\t")) : [], forks, rows };
  }
}
