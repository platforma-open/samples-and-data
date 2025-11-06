import type { MTColumn, PlId } from '@platforma-open/milaboratories.samples-and-data.model';
import { uniquePlId } from '@platforma-sdk/model';
import type { ImportResult } from '../dataimport';

export function columnNamesMatch(existingColumn: string, importColumn: string): boolean {
  return existingColumn.toLocaleLowerCase().trim() === importColumn.toLocaleLowerCase().trim();
}

export type ProcessMetadataColumnsOptions = {
  importCandidate: ImportResult;
  existingMetadata: MTColumn[];
  skipColumnIndices: number[];
};

export type ProcessMetadataColumnsResult = {
  modelColumns: (MTColumn | undefined)[];
  newColumns: MTColumn[];
};

/**
 * Process import candidate columns and match them with existing metadata columns
 * or create new ones. Returns an array mapping each import column to a model column.
 */
export function processMetadataColumns(
  options: ProcessMetadataColumnsOptions,
): ProcessMetadataColumnsResult {
  const { importCandidate, existingMetadata, skipColumnIndices } = options;
  const modelColumns: (MTColumn | undefined)[] = [];
  const newColumns: MTColumn[] = [];

  for (let cIdx = 0; cIdx < importCandidate.data.columns.length; cIdx++) {
    // Skip specified columns (e.g., sample name, file ID)
    if (skipColumnIndices.includes(cIdx)) {
      modelColumns.push(undefined);
      continue;
    }

    const column = importCandidate.data.columns[cIdx];
    const existing = existingMetadata.find((mc) => columnNamesMatch(mc.label, column.header));

    if (existing) {
      modelColumns.push(existing);
    } else {
      // Create new metadata column
      const mColumn: MTColumn = {
        id: uniquePlId(),
        valueType: column.type,
        label: column.header,
        global: true,
        data: {},
      };
      newColumns.push(mColumn);
      modelColumns.push(mColumn);
    }
  }

  return { modelColumns, newColumns };
}

/**
 * Populate metadata for a sample from a row of import data
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
    if (val !== undefined && val !== null && (typeof val === 'string' || typeof val === 'number')) {
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

