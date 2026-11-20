// Copied from tensor_derivation (src/derive.ts at 9492e67). Only import paths changed.
// STEP 1: derive the graph, split groups, components and material classes.
// See SPEC.md. This step reads only the material history, never `meta`.

export type From = { of: string | string[]; part: string; split?: string; step?: string };
export type Material = { from?: From };

export interface Graph {
  ids: string[]; // yaml order
  sequenced: Set<string>; // sampleIds in metadata.tsv
  parents: Record<string, string[]>;
  children: Record<string, string[]>;
  edge: (parent: string, child: string) => From; // a child's `from` is the edge from each parent
  groups_of: Record<string, Map<string, string[]>>; // parent -> split name -> slice children
  roots_of: string[][]; // one set of roots per connected component
  class_of: Record<string, string[]>; // material -> its class (fused across `whole`)
  classes: string[][]; // in yaml order of first member
  sequenced_in: (c: string[]) => string[];
}

export function derive(materials: Record<string, Material>, sequenced: Set<string>): Graph {
  const ids = Object.keys(materials);

  const parents: Record<string, string[]> = {};
  const children: Record<string, string[]> = {};
  for (const id of ids) {
    parents[id] = materials[id]!.from ? [materials[id]!.from!.of].flat() : [];
    children[id] = [];
  }
  for (const id of ids) for (const p of parents[id]!) children[p]!.push(id);
  const edge = (_parent: string, child: string): From => materials[child]!.from!;

  // slices of ONE separation divide their parent between them, so a parent's
  // slice children group by split name. A group of 1 can carry a trajectory
  // step; a group of 2 or more is a division.
  const groups_of: Record<string, Map<string, string[]>> = {};
  for (const id of ids) {
    groups_of[id] = new Map();
    for (const c of children[id]!) {
      const e = edge(id, c);
      if (e.part !== "slice") continue;
      groups_of[id]!.set(e.split!, [...(groups_of[id]!.get(e.split!) ?? []), c]);
    }
  }

  // components: connected parts, ignoring edge direction
  const roots_of: string[][] = [];
  let unassigned = [...ids];
  while (unassigned.length > 0) {
    const seed = unassigned[0];
    const comp = new Set([seed]);
    const stack = [seed];
    while (stack.length > 0) {
      const n = stack.pop()!;
      for (const m of [...parents[n]!, ...children[n]!]) {
        if (!comp.has(m)) {
          comp.add(m);
          stack.push(m);
        }
      }
    }
    unassigned = unassigned.filter((id) => !comp.has(id));
    roots_of.push(ids.filter((id) => comp.has(id) && parents[id]!.length === 0));
  }

  // material classes: unmarked `whole` children of one parent are portions of the
  // same material at the same moment, so they fuse. A `whole` edge with a `step`
  // is a later state, not a portion. Nothing else fuses: not a child with its
  // parent, and not along a chain of `whole` edges.
  const class_of: Record<string, string[]> = {};
  const classes: string[][] = [];
  const isWholeChildOf = (c: string, p: string) =>
    parents[c]!.length === 1 &&
    parents[c]![0]! === p &&
    edge(p, c).part === "whole" &&
    !edge(p, c).step;
  for (const id of ids) {
    if (class_of[id]) continue;
    let members = [id];
    if (isWholeChildOf(id, parents[id]![0]!)) {
      const p = parents[id]![0]!;
      const whole_siblings = ids.filter((c) => isWholeChildOf(c, p)); // yaml order, includes id
      if (whole_siblings.length > 1) members = whole_siblings;
    }
    classes.push(members);
    for (const m of members) class_of[m] = members;
  }
  const sequenced_in = (c: string[]) => c.filter((m) => sequenced.has(m));

  return {
    ids,
    sequenced,
    parents,
    children,
    edge,
    groups_of,
    roots_of,
    class_of,
    classes,
    sequenced_in,
  };
}
