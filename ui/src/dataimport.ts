import type { MTValueType } from '@platforma-open/milaboratories.samples-and-data.model';
import * as XLSX from 'xlsx';

export type ImportDataColumn = {
  readonly type: MTValueType;
  readonly header: string;
};

export type ImportDataCell = string | number | undefined;

export type ImportDataRow = ImportDataCell[];

export type ImportData = {
  readonly columns: ImportDataColumn[];
  readonly rows: ImportDataRow[];
};

export type ImportResult = {
  readonly data: ImportData;
  readonly missingHeaders: number;
  readonly emptyRowsRemoved: number;
  readonly malformedRowsRemoved: number;
  readonly emptyColumns: number;
};

function validateHeader(headerLine: unknown): (string | undefined)[] {
  if (!headerLine || !Array.isArray(headerLine)) throw new Error('Can\'t parse header line');
  return headerLine.map((c) => (!c ? undefined : String(c).trim()));
}

const TypeCodeNone = -1;
const TypeCodeLong = 0;
const TypeCodeDouble = 1;
const TypeCodeString = 2;

function validateAndCleanRow(row: unknown): ImportDataRow | undefined {
  if (!row || !Array.isArray(row)) return undefined;
  if (row.findIndex((c) => c && typeof c !== 'string' && typeof c !== 'number') !== -1)
    return undefined;
  const result: ImportDataRow = [];
  for (const c of row) {
    if (typeof c === 'string') result.push(c.trim());
    else if (typeof c === 'number') result.push(c);
    else if (!c) result.push(undefined);
    else {
      console.log(`Can't parse cell (see below). Type = ${typeof c}`);
      console.dir(c, { depth: 5 });
      return undefined; // unknown cell type
    }
  }
  return result;
}

export function readFileForImport(data: Uint8Array): ImportResult {
  const wb = XLSX.read(data);
  const worksheet = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  // cleaning and validating header
  const headers = validateHeader(rawData[0]);
  let missingHeaders = 0;
  for (const h of headers) if (h === undefined) missingHeaders++;

  // cleaning and validating rows & detecting column types
  const types = headers.map(() => TypeCodeNone);
  const rowsTmp: ImportDataRow[] = [];
  let malformedRowsRemoved = 0;
  let emptyRowsRemoved = 0;
  for (let rowIdx = 1; rowIdx < rawData.length; ++rowIdx) {
    const row = validateAndCleanRow(rawData[rowIdx]);
    if (row === undefined) {
      malformedRowsRemoved++;
      continue;
    }

    let isEmpty = true;

    // adjusting aggregated column types
    for (let colIdx = 0; colIdx < Math.min(row.length, types.length); ++colIdx) {
      if (headers[colIdx] === undefined) continue;

      // detecting type
      const c = row[colIdx];
      if (c === '' || c === undefined) continue;

      isEmpty = false;

      const type
        = typeof c === 'string'
          ? TypeCodeString
          : Number.isInteger(c)
            ? TypeCodeLong
            : TypeCodeDouble;
      types[colIdx] = Math.max(types[colIdx], type);
    }

    if (isEmpty) {
      emptyRowsRemoved++;
      continue;
    }

    rowsTmp.push(row);
  }

  // calculating columns after all filters
  let emptyColumns = 0;
  const idxMapping: number[] = [];
  const columns: ImportDataColumn[] = [];
  for (let colIdx = 0; colIdx < types.length; ++colIdx) {
    const type = types[colIdx];
    const header = headers[colIdx];
    if (header === undefined) continue;
    if (type === TypeCodeNone) {
      emptyColumns++;
      continue;
    }
    idxMapping.push(colIdx);
    columns.push({
      header,
      type: type === TypeCodeLong ? 'Long' : type === TypeCodeDouble ? 'Double' : 'String',
    });
  }

  const rows: ImportDataRow[] = [];
  for (const rowTmp of rowsTmp) {
    const newRow: ImportDataRow = [];
    for (let newColIdx = 0; newColIdx < columns.length; ++newColIdx) {
      const colIdx = idxMapping[newColIdx];
      const c = rowTmp[colIdx];
      newRow.push(
        c === undefined ? undefined : columns[newColIdx].type === 'String' ? String(c) : c,
      );
    }
    rows.push(newRow);
  }

  return {
    data: {
      columns,
      rows,
    },
    missingHeaders,
    emptyColumns,
    emptyRowsRemoved,
    malformedRowsRemoved,
  };
}
