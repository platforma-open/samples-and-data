import { describe, expect, it } from 'vitest';
import type { ImportResult } from '../dataimport';
import { defaultBindingsFor } from './samplesheet-bindings';

function ic(headers: string[]): ImportResult {
  return {
    data: {
      columns: headers.map((header) => ({ header, type: 'String' as const })),
      rows: [],
    },
    missingHeaders: 0,
    emptyRowsRemoved: 0,
    malformedRowsRemoved: 0,
    emptyColumns: 0,
  };
}

describe('defaultBindingsFor', () => {
  it('returns no bindings when no tags are declared (the ticket fix)', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'Condition', 'Treatment']),
      0, 1, [],
    );
    expect(result).toEqual([]);
  });

  it('binds a column whose header matches a declared tag (case-insensitive substring)', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'P5', 'Condition']),
      0, 1, ['P5'],
    );
    expect(result).toEqual([{ tagName: 'P5', columnIdx: 2 }]);
  });

  it('returns no binding for unrelated columns even when a tag is declared', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'Condition', 'Treatment']),
      0, 1, ['P5'],
    );
    expect(result).toEqual([]);
  });

  it('prefers the longer tag when declared tags overlap as substrings', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'i7_index_column']),
      0, 1, ['i7', 'i7_index'],
    );
    expect(result).toEqual([{ tagName: 'i7_index', columnIdx: 2 }]);
  });
});

describe('defaultBindingsFor — barcode-shaped fallback', () => {
  it('auto-binds a "Barcode ID" column as BarcodeID when no tags are declared', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'Barcode ID', 'Condition']),
      0, 1, [],
    );
    expect(result).toEqual([{ tagName: 'BarcodeID', columnIdx: 2 }]);
  });

  it('matches a typo-style header via the barcode substring (case-insensitive)', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'syBarcode ID', 'Condition']),
      0, 1, [],
    );
    expect(result).toEqual([{ tagName: 'BarcodeID', columnIdx: 2 }]);
  });

  it('does not fallback when no barcode-shaped column is present', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'Condition', 'Treatment']),
      0, 1, [],
    );
    expect(result).toEqual([]);
  });

  it('does not fallback when declared tags are present', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'Barcode ID']),
      0, 1, ['P5'],
    );
    expect(result).toEqual([]);
  });

  it('picks the first matching barcode-shaped column when multiple are present', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'Barcode A', 'Barcode B']),
      0, 1, [],
    );
    expect(result).toEqual([{ tagName: 'BarcodeID', columnIdx: 2 }]);
  });
});
