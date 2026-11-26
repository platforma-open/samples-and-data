// Copied from experimental-design-ui-wizard (src/suggest.ts at dfa0b03): the approach B pre-fill only.
/**
 * What a wizard can pre-fill before the user says anything.
 *
 * Only the table is read: column names, values, blanks, and how values are
 * distributed over rows. Every suggestion is a default the user can override,
 * and the evaluation counts how many overrides each study needs.
 */

import type { ColumnB, ConfigB, RoleB } from "./lineage";
import { ordinalOf, type Table } from "./table";

/** Matched against each word of the column name (split on _, -, space and camelCase). */
const NAME: [RegExp, RoleB][] = [
  [/^(generation|gen)s?$/i, "generation"],
  [
    /^(round|pan|panning|biopan|passage|cycle|stage|day|time|timepoint|week|month|visit|hour|hr)s?$/i,
    "series",
  ],
  [/^(bin|gate|quadrant|fraction|population|organ|tissue|subset|compartment)s?$/i, "fraction"],
  [
    /^(rep|replicate|duplicate|lane|capture|well|plate|aliquot|hashtag|hto|cmo|batch|cell)e?s?$/i,
    "copy",
  ],
  [
    /^(animal|donor|subject|individual|participant|patient|mouse|mice|rat|rabbit|llama|alpaca|macaque|strain|host|species|pool|librar(y|ies)|chain|background|source)s?$/i,
    "source",
  ],
  [
    /^(conc|concentration|ph|elution|temp|temperature|stringency|moi|dose|salt|wash)s?$/i,
    "condition",
  ],
  [
    /^(antigen|target|selector|bait|ligand|assay|arm|condition|reagent|method|selection|immunogen|infection|vaccine|drug|compound|treatment|stimulus|perturbation|cohort)s?$/i,
    "treatment",
  ],
];
const words = (c: string): string[] =>
  c
    .replace(/([a-z])([A-Z][a-z])/g, "$1 $2")
    .split(/[_\s-]+/)
    .filter(Boolean);

/**
 * Values meaning "this step had not happened yet", and the usual suffixes (`input library`,
 * `day 0`). The field's own words come first, then the ways a table writes round or day zero. A
 * control arm (`mock`, `untreated`, `none`, `unstimulated`) is deliberately absent: it was run
 * beside the others, not before them. `nt` stays because a FACS study uses it for the untouched
 * population, though it can also read as non-targeting.
 */
const BASELINE = new RegExp(
  "^(" +
    "input|in-put|bulk|stock|parental|parent|initial|start(ing)?|naive|unpanned|unsorted|" +
    "unselected|reference|ref|baseline|nt|librar(y|ies)|lib|plasmid|" +
    "pre-?[ _]?(sort|select(ion|ed)?|enrich(ed|ment)?|immune|bleed|treat(ed|ment)?|dose|" +
    "pan(ning)?|vacc?(ination)?)?" +
    ")([ _-]?(librar(y|ies)|pool|material|sample))?$" +
    "|^(0|[dgprtw]0|(day|round|pan|passage|cycle|time|timepoint|week|month|hour|visit|" +
    "generation|gen)[ _-]?0)$",
  "i",
);

export function distinctValues(table: Table, c: string): string[] {
  return [...new Set(table.rows.map((r) => r.meta[c]).filter((v): v is string => v !== undefined))];
}

/** Values of a column that could plausibly mean "before this step". */
export function baselineCandidates(table: Table, c: string): string[] {
  return distinctValues(table, c).filter((v) => BASELINE.test(v.trim()));
}

export function suggestRoleB(table: Table, c: string): RoleB {
  const vals = distinctValues(table, c);
  if (vals.length <= 1) return "label";
  for (const [re, role] of NAME) if (words(c).some((w) => re.test(w))) return role;
  // values that count up: a series
  if (vals.filter((v) => !BASELINE.test(v)).every((v) => ordinalOf(v) !== null) && vals.length >= 3)
    return "series";
  // one value per row: an identifier, not a structure
  if (vals.length === table.rows.length) return "label";
  return "label";
}

export function suggestB(table: Table): ConfigB {
  const columns: Record<string, ColumnB> = {};
  for (const c of table.columns) {
    const role = suggestRoleB(table, c);
    if (role === "label") continue;
    const base = baselineCandidates(table, c);
    const col: ColumnB = {
      role,
      // a replicate or a generation takes none: neither is the material the others were made from
      ...(base.length && !["source", "copy", "generation"].includes(role)
        ? { baseline: base }
        : {}),
      ...(role === "series"
        ? /day|time|week|visit|hour/i.test(c)
          ? { step: "timecourse" as const }
          : {}
        : {}),
    };
    columns[c] = col;
  }
  return { columns };
}
