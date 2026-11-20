// Copied from experimental-design-ui-wizard (src/table.ts at dfa0b03), plus the StudySpec types it builds.
/**
 * The input every approach starts from — a metadata table — and the few
 * helpers for reading its values. No Node imports: this file is bundled into
 * the browser demo.
 */

export interface Row {
  readonly id: string;
  /** Blank cells are absent. */
  readonly meta: Readonly<Record<string, string>>;
}

export interface Table {
  readonly slug: string;
  readonly name: string;
  readonly columns: readonly string[];
  readonly rows: readonly Row[];
  /**
   * Value orders the author declared. These are part of what a user types in
   * the wizard ("Order of antigen values"), not graph knowledge, so approaches
   * may read them.
   */
  readonly orders: Readonly<Record<string, readonly string[]>>;
}

export const isNumeric = (v: string): boolean => v.trim() !== "" && Number.isFinite(Number(v));

/** A trailing or embedded integer: R4 -> 4, Pan0 -> 0, round 3 -> 3, P11 -> 11. */
export function ordinalOf(v: string): number | null {
  if (isNumeric(v)) return Number(v);
  const m = v.match(/^[A-Za-z _-]*?(\d+(?:\.\d+)?)[A-Za-z]*$/);
  return m ? Number(m[1]) : null;
}

/** Values in their natural order: declared, else numeric, else embedded ordinal, else as met. */
export function naturalOrder(values: readonly string[], declared?: readonly string[]): string[] {
  const vs = [...new Set(values)];
  if (declared) {
    return [...declared.filter((v) => vs.includes(v)), ...vs.filter((v) => !declared.includes(v))];
  }
  if (vs.every(isNumeric)) return vs.sort((a, b) => Number(a) - Number(b));
  if (vs.every((v) => ordinalOf(v) !== null)) {
    return vs.sort((a, b) => ordinalOf(a)! - ordinalOf(b)! || a.localeCompare(b));
  }
  return vs;
}

/** What the wizard builds: the material graph as the experiment-design playground writes it. */
export interface StudySpec {
  name: string;
  orders: Record<string, string[]>;
  materials: Record<string, { from?: FromSpec; meta?: Record<string, string | number> }>;
}

export interface FromSpec {
  of: string | string[];
  part: "whole" | "slice" | "remade";
  split?: string;
  step?: "round" | "timecourse";
}
