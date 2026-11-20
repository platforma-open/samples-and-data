// Copied from experimental-design-ui-wizard (src/approachB-lineage.ts at dfa0b03). Only the imports changed.
/**
 * Approach B — "what each column does to the material", no global order.
 *
 * Approach A asks for one nesting order for the whole table. Real designs are
 * not one nesting: a gate is a fraction at round 1 and a lineage afterwards; an
 * input sample sits above every arm; a new elution appears only at round 4.
 * B drops the global order and finds each sample's parent from the labels:
 *
 *   A sample's parent is the closest OTHER sample it could have been made from:
 *   every label the parent has, the child has too — or, on a series column, the
 *   parent is at an earlier position. A row with fewer labels sits above a row
 *   with more; R2 sits above R3 of the same line.
 *
 * What changed between parent and child then decides the edge: a fraction
 * column gives slices sharing one split; a treatment or condition its own split;
 * a copy a whole; a series a step of a round / timecourse.
 *
 * Every rule that needs knowledge the table does not carry is a per-column
 * option with a default, so it can be surfaced to the user as one question:
 * which values mean "the starting material", which fraction was carried
 * forward, whether missing rounds were run, where a new library came from.
 */

import type { StudySpec } from "./table";
import { naturalOrder, ordinalOf, type Table } from "./table";

export const ROLES_B = [
  "label",
  "source",
  "copy",
  "treatment",
  "condition",
  "fraction",
  "series",
  "generation",
] as const;
export type RoleB = (typeof ROLES_B)[number];

/** What the user reads in the role picker. */
export const ROLE_B_TEXT: Record<RoleB, [string, string]> = {
  label: ["Info only", "Kept as information; not part of the lineage."],
  source: [
    "Independent source",
    "Each value is its own donor, animal, library or biological replicate (separate growth or transfection). Nothing physical is shared.",
  ],
  copy: [
    "Technical replicates",
    "Each value is a technical replicate: another library prep, lane, or aliquot of the same material, with nothing selected. Biological replicates (separate growth or animal) are Independent source.",
  ],
  treatment: [
    "Selection arm",
    "Each value took its own portion, was selected its own way, and stayed a separate arm (antigen, target).",
  ],
  condition: [
    "Selection arm, ramped",
    "Values used one after another along the same arm, not side by side (a stringency ramp, alternating pH, a new elution or cell line at a late round).",
  ],
  fraction: [
    "Sort gates / fractions",
    "One sample was divided; each value is one part (sort gates, bins, sequential elutions, the tissues of one animal).",
  ],
  series: [
    "Rounds or time points",
    "Each value follows the previous value within the same lineage.",
  ],
  generation: [
    "New library generation",
    "A new library was synthesised from hits of the previous one. Nothing physical carried over.",
  ],
};

export interface ColumnB {
  readonly role: RoleB;
  /** Values meaning "this step had not happened yet": input, presort, Uns, round 0. Read as blank. */
  readonly baseline?: readonly string[];
  /**
   * What a row with a baseline value is: the starting material itself (`parent`,
   * default — the input library that every round came from), or an untreated
   * aliquot of it sequenced alongside (`aliquot` — a pre-sort sample next to the sorts).
   */
  readonly baselineIs?: "parent" | "aliquot";
  // ----- series
  readonly step?: "round" | "timecourse" | "none";
  readonly part?: "slice" | "whole";
  /**
   * Insert never-sequenced intermediates for missing integer positions (R1 ... R6).
   * Off by default, and never pre-filled: it adds no tensor, it guesses (days,
   * passages and per-method numbering are not rounds), and it currently inserts
   * the missing rounds above an arm's split, which empties panel arms.
   */
  readonly fillGaps?: boolean;
  /**
   * Sampled again from a subject or vessel that kept going (an animal bled at day 0, 5,
   * 12). The subject becomes an unsequenced line only when a time point holds several
   * samples of it (lymph node and blood); one sample per time point stands in for it.
   */
  readonly spine?: boolean;
  // ----- fraction
  /** Which fraction went on to the next step of a series. Absent / `each` = every fraction became its own line. */
  readonly carry?: string;
  /**
   * What a blank cell means: the step had not happened yet (`before`, default), or
   * a real category of its own — "no antigen" is a population too (`own`).
   */
  readonly blankIs?: "before" | "own";
  // ----- generation
  /** Which material the new library was designed from: the last sequenced pool, or an unsequenced selected pool. */
  readonly remadeFrom?: "last" | "virtual";
  /** Columns whose values are separate new libraries within one generation (two chemistries, two designs). */
  readonly libraryBy?: readonly string[];
}

export interface ConfigB {
  /** Column settings; a column not listed is a label. Listing order breaks ties (outer first). */
  readonly columns: Readonly<Record<string, ColumnB>>;
}

type Materials = StudySpec["materials"];
type From = NonNullable<Materials[string]["from"]>;
type Vec = Readonly<Record<string, string>>;

/** Why each sample got the parent it got — the raw material for questions in the UI. */
export interface Trace {
  readonly parent: Map<string, string>;
  /** Samples whose parent was a tie between candidates the labels could not separate. */
  readonly ties: Map<string, string[]>;
}

export function buildB(table: Table, cfg: ConfigB, trace?: Trace): StudySpec {
  const structural = Object.keys(cfg.columns).filter(
    (c) => cfg.columns[c]!.role !== "label" && table.columns.includes(c),
  );
  const roleOf = (c: string): RoleB => cfg.columns[c]?.role ?? "label";
  const ofRole = (r: RoleB): string[] => structural.filter((c) => roleOf(c) === r);
  const carryOf = (c: string): string | undefined => {
    const k = cfg.columns[c]?.carry;
    return k && k !== "each" ? k : undefined;
  };

  // ---- vectors, with baseline values read as blank
  const vec = new Map<string, Vec>();
  const aliquots = new Set<string>();
  for (const r of table.rows) {
    const v: Record<string, string> = {};
    for (const c of structural) {
      const x = r.meta[c];
      if (
        x !== undefined &&
        cfg.columns[c]!.baseline?.includes(x) &&
        cfg.columns[c]!.baselineIs === "aliquot"
      )
        aliquots.add(r.id);
      if (x === undefined && cfg.columns[c]!.blankIs === "own") {
        v[c] = "(blank)";
        continue;
      }
      if (x === undefined || cfg.columns[c]!.baseline?.includes(x)) continue;
      v[c] = x;
    }
    vec.set(r.id, v);
  }
  const metaOf = new Map(table.rows.map((r) => [r.id, r.meta]));

  const sources = ofRole("source");
  // spine columns where one subject has several samples at one time point
  const spined = new Set(
    ofRole("series").filter((c) => {
      if (!cfg.columns[c]!.spine) return false;
      const seen = new Set<string>();
      for (const v of vec.values()) {
        if (v[c] === undefined) continue;
        const k = JSON.stringify([...sources.map((x) => v[x]), v[c]]);
        if (seen.has(k)) return true;
        seen.add(k);
      }
      return false;
    }),
  );

  // ---- orders of series / generation values
  const orders = new Map<string, string[]>();
  for (const c of [...ofRole("series"), ...ofRole("generation")]) {
    const vals = table.rows
      .map((r) => vec.get(r.id)![c])
      .filter((x): x is string => x !== undefined);
    orders.set(c, naturalOrder(vals, table.orders[c]));
  }
  const pos = (c: string, v: string | undefined): number =>
    v === undefined ? -1 : orders.get(c)!.indexOf(v);

  // ---- output
  const materials: Materials = {};
  const memo = new Map<string, string>();
  let n = 0;
  const virtual = (key: string, from: From | null, hint: string): string => {
    const hit = memo.get(key);
    if (hit) return hit;
    const id = `~${hint.replace(/[^A-Za-z0-9_.=-]+/g, "_")}#${(n += 1)}`;
    materials[id] = from ? { from } : {};
    memo.set(key, id);
    return id;
  };
  const sample = (id: string, from: From | null): void => {
    materials[id] = { ...(from ? { from } : {}), meta: { ...metaOf.get(id)! } };
  };

  const genCol = ofRole("generation")[0];
  const series = ofRole("series");

  // ------------------------------------------------------------------
  // 1. sources: rows sharing source values share a start
  // ------------------------------------------------------------------
  const groups = new Map<string, string[]>();
  for (const r of table.rows) {
    const k = sources.map((c) => vec.get(r.id)![c] ?? "∅").join("|");
    groups.set(k, [...(groups.get(k) ?? []), r.id]);
  }

  for (const [gkey, ids] of groups) {
    const only = (id: string, cols: readonly string[]): boolean =>
      Object.keys(vec.get(id)!).every((c) => cols.includes(c));
    const own = ids.filter((id) => only(id, sources));
    let root: string;
    if (own.length) {
      root = own[0]!;
      sample(root, null);
      for (const extra of own.slice(1)) sample(extra, { of: root, part: "whole" });
    } else {
      root = virtual(`root:${gkey}`, null, sources.length ? `start.${gkey}` : "START");
    }
    const rest = ids.filter((id) => !own.includes(id));

    // ---- 2. generations: each later one starts at a remade library
    if (!genCol) {
      placeLayer(root, rest);
      continue;
    }
    const gOrder = orders.get(genCol)!;
    let prevStart = root;
    let prevIds: string[] = [];
    gOrder.forEach((g, i) => {
      let ids2 = rest.filter((id) =>
        i === 0
          ? vec.get(id)![genCol] === undefined || vec.get(id)![genCol] === g
          : vec.get(id)![genCol] === g,
      );
      let start = root;
      if (i > 0) {
        let from: string[];
        if (cfg.columns[genCol]!.remadeFrom === "last" && prevIds.length) {
          const depth = (id: string): number => {
            let d = 0;
            let cur: string | undefined = id;
            while (cur) {
              const of: string | string[] | undefined = materials[cur]?.from?.of;
              cur = Array.isArray(of) ? of[0] : of;
              d += 1;
            }
            return d;
          };
          const max = Math.max(...prevIds.map(depth));
          from = prevIds.filter((id) => depth(id) === max);
        } else {
          from = [
            virtual(
              `term:${prevStart}`,
              { of: prevStart, part: "slice", split: `selected@${prevStart}` },
              `${genCol}-selected`,
            ),
          ];
        }
        const of = from.length === 1 ? from[0]! : from;
        const by = cfg.columns[genCol!]!.libraryBy ?? [];
        const libKey = (id: string): string => by.map((c) => metaOf.get(id)![c] ?? "").join("|");
        const libs = [...new Set(ids2.map(libKey))];
        let first: string | null = null;
        for (const lk of libs) {
          let mine = ids2.filter((id) => libKey(id) === lk);
          const lib = mine.filter((id) => only(id, [...sources, genCol!]));
          let s0: string;
          if (lib.length) {
            s0 = lib[0]!;
            sample(s0, { of, part: "remade" });
            mine = mine.filter((id) => !lib.includes(id));
          } else {
            s0 = virtual(
              `gen:${gkey}:${g}:${lk}`,
              { of, part: "remade" },
              `${genCol}=${g}${lk ? `.${lk}` : ""}`,
            );
          }
          placeLayer(s0, mine);
          first ??= s0;
        }
        prevStart = first ?? prevStart;
        prevIds = ids2;
        return;
      }
      placeLayer(start, ids2);
      prevStart = start;
      prevIds = ids2;
    });
  }

  // ------------------------------------------------------------------
  // 3. within one start: find parents, then build edges
  // ------------------------------------------------------------------
  function placeLayer(start: string, ids: readonly string[]): void {
    const ignore = new Set<string>([...sources, ...(genCol ? [genCol] : [])]);
    const cols = structural.filter((c) => !ignore.has(c));
    const v = (id: string): Vec => {
      const out: Record<string, string> = {};
      for (const [c, x] of Object.entries(vec.get(id)!)) if (!ignore.has(c)) out[c] = x;
      return out;
    };
    const keyOf = (x: Vec): string => JSON.stringify(Object.entries(x).sort());

    // identical label vectors: copies of one node
    const byVec = new Map<string, string[]>();
    for (const id of ids) {
      const k = keyOf(v(id));
      byVec.set(k, [...(byVec.get(k) ?? []), id]);
    }
    const nodes: { id: string; vec: Vec; members: string[] }[] = [];
    for (const members of byVec.values()) {
      nodes.push({
        // an aliquot stands beside the material it was taken from, never above its descendants
        id:
          members.length === 1 && !aliquots.has(members[0]!)
            ? members[0]!
            : virtual(`copies:${members[0]}`, null, `copies-of-${members[0]}`),
        vec: v(members[0]!),
        members,
      });
    }

    /** Is there a series step from q to r (r further along, or q before the series began)? */
    const stepped = (q: Vec, r: Vec): boolean =>
      series.some(
        (c) =>
          !ignore.has(c) &&
          r[c] !== undefined &&
          (q[c] === undefined || pos(c, q[c]) < pos(c, r[c])),
      );

    /** Could q be upstream of r? */
    const le = (q: Vec, r: Vec): boolean => {
      const st = stepped(q, r);
      for (const [d, qd] of Object.entries(q)) {
        const rd = r[d];
        const role = roleOf(d);
        // one fraction was carried forward: the others ended there
        if (role === "fraction" && st && carryOf(d) !== undefined) {
          if (qd === carryOf(d)) continue;
          return false;
        }
        if (qd === rd) continue;
        // taken off a line: a sample never feeds the line's later positions
        if (role === "series" && spined.has(d)) return false;
        if (role === "series" && rd !== undefined && pos(d, qd) < pos(d, rd)) continue;
        if (role === "condition" && st) continue;
        return false;
      }
      return true;
    };
    const agree = (q: Vec, r: Vec): number =>
      Object.entries(q).filter(([d, x]) => r[d] === x).length;
    const spec = (x: Vec): number => {
      let s = Object.keys(x).length * 1000;
      for (const c of series) if (x[c] !== undefined) s += pos(c, x[c]) + 1;
      return s;
    };

    const parentOf = new Map<string, { id: string; vec: Vec } | null>();
    for (const node of nodes) {
      const cands = nodes.filter(
        (q) => q !== node && le(q.vec, node.vec) && keyOf(q.vec) !== keyOf(node.vec),
      );
      // keep the closest: candidates no other candidate sits below
      const maximal = cands.filter(
        (q) => !cands.some((q2) => q2 !== q && le(q.vec, q2.vec) && !le(q2.vec, q.vec)),
      );
      maximal.sort(
        (a, b) => agree(b.vec, node.vec) - agree(a.vec, node.vec) || spec(b.vec) - spec(a.vec),
      );
      const pick = maximal[0] ?? null;
      parentOf.set(node.id, pick);
      if (trace) {
        trace.parent.set(node.id, pick?.id ?? start);
        const top = maximal.filter(
          (q) =>
            pick &&
            agree(q.vec, node.vec) === agree(pick.vec, node.vec) &&
            spec(q.vec) === spec(pick.vec),
        );
        if (top.length > 1)
          trace.ties.set(
            node.id,
            top.map((q) => q.id),
          );
      }
    }

    /**
     * Turn "parent -> child" into one or more edges. Intermediate materials are
     * virtual, and shared between siblings that took the same path.
     */
    const edgeChain = (parent: string, pv: Vec, r: Vec): From => {
      let cur = parent;
      const st = stepped(pv, r);
      const changed = (c: string): boolean => r[c] !== undefined && pv[c] !== r[c];

      // the series step: innermost series column that moved
      const moved = series.filter((c) => !ignore.has(c) && changed(c));
      const stepCol = moved[moved.length - 1];
      let key: string[] = moved.filter((c) => c !== stepCol).map((c) => `${c}=${r[c]}`);
      let step: { col: string; from: string | undefined; to: string } | null = stepCol
        ? { col: stepCol, from: pv[stepCol], to: r[stepCol]! }
        : null;

      const stepEdge = (of: string, split: string): From => {
        const col = cfg.columns[step!.col]!;
        const s = col.step ?? "round";
        if ((col.part ?? "slice") === "whole")
          return { of, part: "whole", ...(s !== "none" ? { step: s } : {}) };
        return { of, part: "slice", split, ...(s !== "none" ? { step: s } : {}) };
      };

      // a line that was never sequenced: walk it, and take the sample off it
      if (step && spined.has(step.col)) {
        const c = step.col;
        const upto = pos(c, step.to);
        for (let i = step.from === undefined ? 0 : pos(c, step.from) + 1; i <= upto; i += 1) {
          const at = orders.get(c)![i]!;
          const kk = `${cur}|spine:${c}=${at}`;
          // the subject only aged; it is not a step of a series (no `step`), as the true graphs write it
          const { step: _, ...edge } = stepEdge(cur, kk);
          cur = virtual(kk, edge, `${c}=${at}`);
        }
        step = null;
      }

      // missing integer positions become unsequenced steps
      if (step && cfg.columns[step.col]!.fillGaps) {
        const c = step.col;
        const toO = ordinalOf(step.to);
        let fromO = step.from !== undefined ? ordinalOf(step.from) : null;
        if (step.from === undefined) {
          const base = cfg.columns[c]!.baseline?.map(ordinalOf).find((x) => x !== null);
          const known = orders
            .get(c)!
            .map(ordinalOf)
            .filter((x): x is number => x !== null);
          fromO = base ?? (known.length ? Math.min(...known) - 1 : null);
        }
        if (
          toO !== null &&
          fromO !== null &&
          Number.isInteger(toO) &&
          Number.isInteger(fromO) &&
          toO - fromO <= 12
        ) {
          for (let k = fromO + 1; k < toO; k += 1) {
            const kk = `${cur}|${c}=${k}|${key.join(",")}`;
            cur = virtual(kk, stepEdge(cur, kk), `${c}${k}`);
          }
        }
      }

      // what else this edge does. Copies listed before any treatment happen first
      // (a replicate portion, then its sorts); the treatments and the first cut make
      // one separation; further cuts nest; copies listed after a treatment come last
      // (a sorted pool split over sequencing lanes).
      const keys: string[] = [];
      const cuts: string[] = [];
      const pre: string[] = [];
      const post: string[] = [];
      for (const c of cols) {
        const role = roleOf(c);
        if (role === "series") continue;
        if ((role === "treatment" || role === "condition") && changed(c)) keys.push(c);
        if (role === "copy" && changed(c)) (keys.length || cuts.length ? post : pre).push(c);
        // a fraction is cut again at every step when one fraction is carried forward
        if (
          role === "fraction" &&
          (changed(c) || (st && r[c] !== undefined && carryOf(c) !== undefined))
        )
          cuts.push(c);
      }
      key = [...key, ...keys.map((c) => `${c}=${r[c]}`)];

      type Op = { kind: "copy" | "cut" | "slice" | "pre"; cols: string[] };
      const ops: Op[] = [];
      if (pre.length) ops.push({ kind: "pre", cols: pre });
      if (cuts.length) cuts.forEach((c) => ops.push({ kind: "cut", cols: [c] }));
      else if ((key.length || step) && post.length) ops.push({ kind: "slice", cols: [] });
      if (post.length) ops.push({ kind: "copy", cols: post });

      const splitName = (): string =>
        `${cur}|${step ? `${step.col}=${step.to}` : ""}|${key.join(",")}`;
      const walked: string[] = [];
      for (let i = 0; i < ops.length; i += 1) {
        const op = ops[i]!;
        let e: From;
        const splitHere = splitName();
        if (op.kind === "pre" || (op.kind === "copy" && !(key.length || step))) {
          e = { of: cur, part: "whole" };
        } else if (op.kind === "copy") {
          // something must be cut before a copy can be taken of it
          const split = splitName();
          e = step ? stepEdge(cur, split) : { of: cur, part: "slice", split };
          cur = virtual(`${cur}|cut:${split}`, e, "cut");
          key = [];
          step = null;
          e = { of: cur, part: "whole" };
        } else {
          const split = splitName();
          e = step ? stepEdge(cur, split) : { of: cur, part: "slice", split };
          if (e.part === "whole")
            e = { of: cur, part: "slice", split, ...(e.step ? { step: e.step } : {}) };
          key = [];
          step = null;
        }
        walked.push(op.cols.map((c) => `${c}=${r[c]}`).join(",") || "cut");
        if (i === ops.length - 1 && !key.length && !step) return e;
        cur = virtual(
          `${cur}|${walked.join("/")}|${op.kind === "copy" || op.kind === "pre" ? "" : splitHere}`,
          e,
          walked[walked.length - 1]!,
        );
      }
      if (step) return stepEdge(cur, splitName());
      if (key.length) return { of: cur, part: "slice", split: splitName() };
      return { of: cur, part: "whole" }; // nothing changed: a copy
    };

    const done = new Set<string>();
    const build = (node: (typeof nodes)[number]): void => {
      if (done.has(node.id)) return;
      done.add(node.id);
      const p = parentOf.get(node.id) ?? null;
      if (p) build(nodes.find((x) => x.id === p.id)!);
      const from = edgeChain(p?.id ?? start, p?.vec ?? {}, node.vec);
      if (node.members.length === 1 && node.id === node.members[0]) {
        sample(node.id, from);
      } else {
        materials[node.id] = { from };
        for (const m of node.members) sample(m, { of: node.id, part: "whole" });
      }
    };
    for (const node of nodes) build(node);
  }

  return { name: table.name, orders: { ...table.orders } as Record<string, string[]>, materials };
}
