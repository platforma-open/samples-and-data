// Copied from tensor_derivation (src/tensors.ts at 9492e67). Only import paths changed.
// STEP 2: infer tensors. See SPEC.md.
// pass A walks each component for partitions, recurrences and panels;
// pass B builds trajectories from a predecessor relation, no traversal.
import type { Graph } from "./derive";

export type Position = string[]; // the sequenced members of one class
export interface Panel {
  anchor: string;
  reads: Position;
  arms: Record<string, Position[]>;
}
export interface Tensors {
  trajectories: Position[][];
  partitions: Position[][];
  panels: Panel[];
  recurrences: Position[][]; // [] or [one recurrence], whose positions are the components
}

export function inferTensors(g: Graph): Tensors {
  const {
    parents,
    children,
    edge,
    groups_of,
    roots_of,
    class_of,
    classes,
    sequenced,
    sequenced_in,
  } = g;

  const partitions: string[][] = [];
  const recurrences: string[][] = [];
  const panels: { anchor: string; arms: Map<string, string[]> }[] = [];

  // ---- pass A: BFS per component ----------------------------------------
  for (const roots of roots_of) {
    const connected: string[] = [];
    const queue = [...roots];
    const visited = new Set(roots);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (sequenced.has(current)) connected.push(current);

      for (const child of children[current]!) {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
        }
      }

      const groups = groups_of[current]!;
      // more than one slice child with the same split name: a partition
      for (const group of groups.values()) if (group.length > 1) partitions.push(group);
      // more than one split name: a panel, one arm per split name
      // a `whole` child with no `step` is a separate portion of this material, so
      // its slice children are arms of this panel too. A `whole` child marked
      // `step: timecourse` is a later state, not a portion, and is not looked through.
      const arms = new Map(groups);
      const sources = new Set<string>(groups.size > 0 ? [current] : []);
      for (const w of children[current]!) {
        if (parents[w]!.length !== 1) continue;
        const e = edge(current, w);
        if (e.part !== "whole" || e.step) continue;
        for (const [k, v] of groups_of[w]!) {
          arms.set(`${w}/${k}`, v);
          sources.add(w);
        }
      }
      // arms that all come through one whole child are that child's own panel
      const onlyThroughOneChild = sources.size === 1 && !sources.has(current);
      if (arms.size > 1 && !onlyThroughOneChild) panels.push({ anchor: current, arms });
    }
    if (roots_of.length > 1 && connected.length > 0) recurrences.push(connected);
  }

  // ---- pass B: trajectories without traversal ---------------------------
  // m is one piece of a division
  function is_piece(m: string): boolean {
    if (parents[m]!.length !== 1) return false;
    const p = parents[m]![0]!;
    const e = edge(p, m);
    return e.part === "slice" && groups_of[p]!.get(e.split!)!.length > 1;
  }

  // every material x descends from, x included
  function ancestors(x: string): Set<string> {
    const seen = new Set([x]);
    const stack = [x];
    while (stack.length > 0) {
      for (const q of parents[stack.pop()!]!)
        if (!seen.has(q)) {
          seen.add(q);
          stack.push(q);
        }
    }
    return seen;
  }

  // a merge: the nearest material that every parent of n descends from, with no
  // `remade` edge on any path from it to n. null if there is no single such material.
  function merge_source(n: string): string | null {
    const sets = parents[n]!.map(ancestors);
    const common = [...sets[0]!].filter((x) => sets.every((s) => s.has(x)));
    // nearest: a common ancestor that no other common ancestor descends from
    const nearest = common.filter((c) => !common.some((d) => d !== c && ancestors(d).has(c)));
    if (nearest.length !== 1) return null;
    const p = nearest[0]!;
    // every material between p and n (p excluded) must not be `remade`
    const between = [...ancestors(n)].filter((x) => x !== p && x !== n && ancestors(x).has(p));
    if (between.some((x) => edge(parents[x]![0]!, x).part === "remade")) return null;
    return p;
  }

  function step_above(start: string): { above: string[]; piece: boolean } | null {
    let n = start;
    while (true) {
      if (parents[n]!.length === 0) return null;
      if (edge(parents[n]![0]!, n).part === "remade") return null; // every parent of n shares n's `from`
      let p: string | null;
      if (parents[n]!.length === 1) p = parents[n]![0]!;
      else {
        p = merge_source(n);
        if (p === null) return null;
      } // a merge
      if (sequenced_in(class_of[p]!).length > 0)
        return { above: class_of[p]!, piece: is_piece(start) };
      n = p;
    }
  }

  const live = classes.filter((c) => sequenced_in(c).length > 0);
  const position_above = new Map<string[], string[] | null>();
  const piece = new Map<string[], boolean>();
  for (const c of live) {
    let found: { above: string[]; piece: boolean } | null = null;
    for (const m of c) {
      found = step_above(m);
      if (found !== null) break;
    }
    position_above.set(c, found?.above ?? null);
    piece.set(c, found?.piece ?? false);
  }

  const position_below = new Map<string[], string[][]>();
  for (const c of live) {
    const a = position_above.get(c)!;
    if (a !== null) position_below.set(a, [...(position_below.get(a) ?? []), c]);
  }

  // read maximal paths
  const paths: string[][][] = [];
  function walk(c: string[], path: string[][]): void {
    const below = position_below.get(c) ?? [];
    if (below.length === 0) {
      // a two-position path ending in one piece of a division is left to that piece's partition
      if (path.length > 2 || (path.length === 2 && !piece.get(path[1]!))) paths.push(path);
      return;
    }
    for (const n of below) walk(n, [...path, n]);
  }
  for (const c of live) if (position_above.get(c) === null) walk(c, [c]);

  // a material with no reads of its own is read through its unmarked whole
  // children: portions of it at the same moment (lanes, captures, aliquots)
  function reads_of(m: string): string[] {
    const own = sequenced_in(class_of[m]!);
    if (own.length > 0) return own;
    return sequenced_in(
      children[m]!.filter(
        (c) => parents[c]!.length === 1 && edge(m, c).part === "whole" && !edge(m, c).step,
      ),
    );
  }

  // ---- render: a position is the sequenced members of its class ---------
  return {
    trajectories: paths.map((t) => t.map(sequenced_in)),
    partitions: partitions.map((grp) => grp.map(reads_of)),
    panels: panels.map((p) => ({
      anchor: p.anchor,
      reads: reads_of(p.anchor),
      arms: Object.fromEntries([...p.arms].map(([split, grp]) => [split, grp.map(reads_of)])),
    })),
    recurrences: recurrences.length > 0 ? [recurrences] : [],
  };
}
