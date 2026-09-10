import type {
  MTColumn,
  MTValueType,
  PlId,
} from "@platforma-open/milaboratories.samples-and-data.model";
import { uniquePlId } from "@platforma-sdk/model";
import type { ImportResult } from "../dataimport";

export function columnNamesMatch(existingColumn: string, importColumn: string): boolean {
  return labelKey(existingColumn) === labelKey(importColumn);
}

/**
 * Whether values of an import column of type `source` can be written into an
 * existing metadata column of type `target`. Strings take anything (numbers
 * are stringified on write), doubles take integers, integers take only integers.
 */
export function isColumnTypeCompatible(target: MTValueType, source: MTValueType): boolean {
  if (target === "String") return true;
  if (target === "Double") return source === "Double" || source === "Long";
  return source === "Long";
}

/**
 * What happens to one column of the imported file: it becomes a metadata column
 * of its own, it fills an existing metadata column keeping that column's
 * identity, or it is left out of the project.
 */
export type ColumnTarget =
  | { type: "new" }
  | { type: "existing"; columnId: string }
  | { type: "ignore" };

export const TARGET_NEW: ColumnTarget = { type: "new" };
export const TARGET_IGNORE: ColumnTarget = { type: "ignore" };

/** Index of a column in the imported file -> what that column does. */
export type MetadataColumnMapping = Record<number, ColumnTarget>;

/**
 * Default mapping: a file column fills the first existing metadata column that
 * carries the same name (case-insensitive, trimmed) and a compatible type, and
 * becomes a new column when no such column is free. Columns in
 * `skipColumnIndices` (sample name, file id) are always ignored.
 */
export function defaultColumnMapping(
  existingMetadata: readonly MTColumn[],
  importCandidate: ImportResult,
  skipColumnIndices: readonly number[],
): MetadataColumnMapping {
  const mapping: MetadataColumnMapping = {};
  const claimed = new Set<string>();
  for (let cIdx = 0; cIdx < importCandidate.data.columns.length; cIdx++) {
    if (skipColumnIndices.includes(cIdx)) {
      mapping[cIdx] = TARGET_IGNORE;
      continue;
    }
    const c = importCandidate.data.columns[cIdx];
    const match = existingMetadata.find(
      (mc) =>
        !claimed.has(mc.id) &&
        columnNamesMatch(mc.label, c.header) &&
        isColumnTypeCompatible(mc.valueType, c.type),
    );
    if (match) {
      claimed.add(match.id);
      mapping[cIdx] = { type: "existing", columnId: match.id };
    } else {
      mapping[cIdx] = TARGET_NEW;
    }
  }
  return mapping;
}

/** Existing metadata columns no file column fills; their values stay as they are. */
export function unfilledExistingColumns(
  existingMetadata: readonly MTColumn[],
  mapping: MetadataColumnMapping,
): MTColumn[] {
  const filled = new Set<string>();
  for (const target of Object.values(mapping))
    if (target.type === "existing") filled.add(target.columnId);
  return existingMetadata.filter((mc) => !filled.has(mc.id));
}

export type ResolveMetadataColumnsOptions = {
  importCandidate: ImportResult;
  existingMetadata: readonly MTColumn[];
  skipColumnIndices: readonly number[];
  /** What each file column does; see {@link defaultColumnMapping}. */
  mapping: MetadataColumnMapping;
};

export type ResolveMetadataColumnsResult = {
  /** Per file column: the model column its values go to, or `undefined` to skip it. */
  modelColumns: (MTColumn | undefined)[];
  /** Freshly created columns, not yet added to the model. */
  newColumns: MTColumn[];
};

/**
 * Turns the mapping into the column objects the import writes into: the
 * existing column a file column was pointed at, or a newly created one. A file
 * column pointed at a column that is not in `existingMetadata` (deleted while
 * the dialog was open) becomes a new column instead. Two file columns pointed
 * at the same existing column are honoured in order, so the later one wins on
 * every sample it carries a value for.
 *
 * A created column never takes a label another column already carries: a global
 * metadata column is exported under its label, so two columns sharing one would
 * be exported as one and lose each other's values. The clash is settled by
 * numbering the newcomer, and `newColumns` carries the label it actually got.
 */
export function resolveMetadataColumns(
  options: ResolveMetadataColumnsOptions,
): ResolveMetadataColumnsResult {
  const { importCandidate, existingMetadata, skipColumnIndices, mapping } = options;

  const modelColumns: (MTColumn | undefined)[] = [];
  const newColumns: MTColumn[] = [];
  const takenLabels = new Set(existingMetadata.map((mc) => labelKey(mc.label)));
  for (let cIdx = 0; cIdx < importCandidate.data.columns.length; cIdx++) {
    const target = skipColumnIndices.includes(cIdx) ? TARGET_IGNORE : (mapping[cIdx] ?? TARGET_NEW);
    if (target.type === "ignore") {
      modelColumns.push(undefined);
      continue;
    }
    if (target.type === "existing") {
      const existing = existingMetadata.find((mc) => mc.id === target.columnId);
      if (existing) {
        modelColumns.push(existing);
        continue;
      }
    }
    const column = importCandidate.data.columns[cIdx];
    const label = freeLabel(column.header.trim(), takenLabels);
    takenLabels.add(labelKey(label));
    const mColumn: MTColumn = {
      id: uniquePlId(),
      valueType: column.type,
      label,
      global: true,
      data: {},
    };
    newColumns.push(mColumn);
    modelColumns.push(mColumn);
  }

  return { modelColumns, newColumns };
}

export type ProcessMetadataColumnsOptions = {
  importCandidate: ImportResult;
  existingMetadata: MTColumn[];
  skipColumnIndices: number[];
};

/**
 * Name-based merge: file columns fill existing columns with the same name and
 * become new columns otherwise. Equivalent to {@link resolveMetadataColumns}
 * over the {@link defaultColumnMapping}.
 */
export function processMetadataColumns(
  options: ProcessMetadataColumnsOptions,
): ResolveMetadataColumnsResult {
  const { importCandidate, existingMetadata, skipColumnIndices } = options;
  return resolveMetadataColumns({
    importCandidate,
    existingMetadata,
    skipColumnIndices,
    mapping: defaultColumnMapping(existingMetadata, importCandidate, skipColumnIndices),
  });
}

/**
 * Populate metadata for a sample from a row of import data. Numbers written
 * into a String column are stringified; a string written into a numeric column
 * is dropped, since the mapping is supposed to be type-compatible.
 */
export function populateMetadataFromRow(
  row: unknown[],
  sampleId: PlId,
  modelColumns: (MTColumn | undefined)[],
): void {
  for (let cIdx = 0; cIdx < row.length; cIdx++) {
    const column = modelColumns[cIdx];
    if (column === undefined) continue; // Skip columns
    const val = row[cIdx];
    if (val === undefined || val === null) continue;
    if (typeof val === "number") {
      column.data[sampleId] = column.valueType === "String" ? String(val) : val;
    } else if (typeof val === "string" && column.valueType === "String") {
      column.data[sampleId] = val;
    }
  }
}

/**
 * Extract metadata values from a row into a record
 */
export function extractMetadataFromRow(
  row: unknown[],
  modelColumns: (MTColumn | undefined)[],
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (let cIdx = 0; cIdx < row.length; cIdx++) {
    const column = modelColumns[cIdx];
    if (column === undefined) continue; // Skip columns
    const val = row[cIdx];
    if (val !== undefined && val !== null) {
      metadata[column.id as string] = val;
    }
  }
  return metadata;
}

// Internals

/**
 * Two labels name the same metadata column when they differ only in case or in
 * surrounding spaces, so both the matching and the clash check compare labels
 * through this key rather than literally.
 */
function labelKey(label: string): string {
  return label.toLocaleLowerCase().trim();
}

/**
 * `label` itself when free, otherwise the first of "label (2)", "label (3)"
 * that no column has taken.
 */
function freeLabel(label: string, taken: ReadonlySet<string>): string {
  if (!taken.has(labelKey(label))) return label;
  for (let n = 2; ; n++) {
    const candidate = `${label} (${n})`;
    if (!taken.has(labelKey(candidate))) return candidate;
  }
}
