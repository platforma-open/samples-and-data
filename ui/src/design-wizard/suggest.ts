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
  [/^(generation|gen)$/i, "generation"],
  [
    /^(round|rounds|pan|panning|passage|selection|cycle|sort|stage|day|days|time|timepoint|tc|week|visit|step|hour|hr)$/i,
    "series",
  ],
  [/^(bin|bins|gate|population|fraction|organ|tissue|subset|compartment)$/i, "fraction"],
  [/^(rep|replicate|lane|capture|well|aliquot|hashtag|batch|cells|cell)$/i, "copy"],
  [
    /^(animal|donor|subject|individual|mouse|patient|pool|library|chain|background|source)$/i,
    "source",
  ],
  [/^(conc|concentration|ph|elution|temperature|stringency|moi|dose|nm|um)$/i, "condition"],
  [
    /^(antigen|target|selector|assay|arm|condition|reagent|method|immunogen|infection|cohort)$/i,
    "treatment",
  ],
];
const words = (c: string): string[] =>
  c
    .replace(/([a-z])([A-Z][a-z])/g, "$1 $2")
    .split(/[_\s-]+/)
    .filter(Boolean);

/**
 * Values meaning "this step had not happened yet". The field's own words come first (`input`,
 * `unsorted`, `bulk`, `presort`), then the ways a table writes round or day zero. A control arm
 * (`mock`, `untreated`) is deliberately absent: it was run beside the others, not before them.
 */
const BASELINE =
  /^(input|in-?put|bulk|stock|parental|parent|initial|start(ing)?|naive|unpanned|uns.*|ref|reference|base(line)?|nt|none|lib.*|plasmid|pre-? ?(sort|select(ion|ed)?|enrich(ed|ment)?|immune|bleed|treat(ed|ment)?|dose|pan(ning)?|vacc?(ination)?)?|0|[dgprt]0|(day|round|pan|passage|time|timepoint|generation|gen) ?0)$/i;

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
