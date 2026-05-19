import { describe, expect, it } from 'vitest';
import type { ImportResult } from '../dataimport';
import {
  defaultBindingsFor,
  legacyBarcodeBindingFor,
  pickTagNameForBinding,
  sanitizeTagName,
} from './samplesheet-bindings';

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
  it('returns no bindings when no tags are declared', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'Condition', 'Treatment']),
      0, 1, [],
    );
    expect(result).toEqual([]);
  });

  it('binds a column to a declared tag by case-insensitive substring', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'P5_barcode', 'Condition']),
      0, 1, ['P5'],
    );
    expect(result).toEqual([{ tagName: 'P5', columnIdx: 2 }]);
  });

  it('binds all columns matching a declared tag with deduplicated tag names', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'P5_a', 'P5_b']),
      0, 1, ['P5'],
    );
    expect(result.map((b) => b.columnIdx)).toEqual([2, 3]);
    expect(new Set(result.map((b) => b.tagName)).size).toBe(2);
  });

  it('matches the longest declared tag first to avoid substring shadowing', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'P5extra_barcode']),
      0, 1, ['P5', 'P5extra'],
    );
    expect(result).toEqual([{ tagName: 'P5extra', columnIdx: 2 }]);
  });

  it('always excludes the File and Sample columns', () => {
    const result = defaultBindingsFor(
      ic(['file_id', 'sample_id', 'P5']),
      0, 1, ['file_id', 'sample_id', 'P5'],
    );
    expect(result).toEqual([{ tagName: 'P5', columnIdx: 2 }]);
  });

  it('returns no binding for unrelated columns even when other tags are declared', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'Condition', 'Treatment', 'P5']),
      0, 1, ['P5'],
    );
    expect(result).toEqual([{ tagName: 'P5', columnIdx: 4 }]);
  });
});

describe('pickTagNameForBinding', () => {
  it('returns the declared tag when the header contains it', () => {
    expect(pickTagNameForBinding('P5_barcode', ['P5'], new Set())).toBe('P5');
  });

  it('matches the longest declared tag first', () => {
    expect(pickTagNameForBinding('P5extra_barcode', ['P5', 'P5extra'], new Set()))
      .toBe('P5extra');
  });

  it('falls back to the sanitized header when no declared tag matches', () => {
    expect(pickTagNameForBinding('P7-barcode', ['P5'], new Set())).toBe('P7barcode');
  });

  it('returns the header as-is when it is already alphanumeric and no tag matches', () => {
    expect(pickTagNameForBinding('P7', [], new Set())).toBe('P7');
  });

  it('appends a numeric suffix when the picked name collides', () => {
    expect(pickTagNameForBinding('P5_barcode', ['P5'], new Set(['P5']))).toBe('P52');
  });
});

describe('legacyBarcodeBindingFor', () => {
  it('returns undefined when no column looks like a barcode column', () => {
    const r = legacyBarcodeBindingFor(
      ic(['File', 'Sample', 'Condition', 'Treatment']),
      0, 1,
    );
    expect(r).toBeUndefined();
  });

  it('returns a BarcodeID binding for an exact "Barcode ID" header', () => {
    const r = legacyBarcodeBindingFor(
      ic(['File', 'Sample', 'Barcode ID']),
      0, 1,
    );
    expect(r).toEqual({ tagName: 'BarcodeID', columnIdx: 2 });
  });

  it('matches case-insensitively', () => {
    const r = legacyBarcodeBindingFor(
      ic(['File', 'Sample', 'BARCODE_index']),
      0, 1,
    );
    expect(r).toEqual({ tagName: 'BarcodeID', columnIdx: 2 });
  });

  it('matches substrings — header containing "barcode"', () => {
    const r = legacyBarcodeBindingFor(
      ic(['File', 'Sample', 'syBarcode ID']),
      0, 1,
    );
    expect(r).toEqual({ tagName: 'BarcodeID', columnIdx: 2 });
  });

  it('excludes the File and Sample columns', () => {
    const r = legacyBarcodeBindingFor(
      ic(['Barcode_File', 'Barcode_Sample', 'P5']),
      0, 1,
    );
    expect(r).toBeUndefined();
  });

  it('returns the first matching column when several would match', () => {
    const r = legacyBarcodeBindingFor(
      ic(['File', 'Sample', 'BarcodeA', 'BarcodeB']),
      0, 1,
    );
    expect(r).toEqual({ tagName: 'BarcodeID', columnIdx: 2 });
  });
});

describe('sanitizeTagName', () => {
  it('strips non-alphanumeric characters', () => {
    expect(sanitizeTagName('P5-barcode')).toBe('P5barcode');
  });
  it('falls back to "Tag" for empty input', () => {
    expect(sanitizeTagName('---')).toBe('Tag');
  });
});
