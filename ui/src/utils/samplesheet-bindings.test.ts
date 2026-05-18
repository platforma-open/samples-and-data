import { describe, expect, it } from 'vitest';
import type { ImportResult } from '../dataimport';
import { defaultBindingsFor, sanitizeTagName } from './samplesheet-bindings';

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

  it('binds each declared tag at most once even if multiple columns match', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'P5_a', 'P5_b']),
      0, 1, ['P5'],
    );
    expect(result.map((b) => b.columnIdx)).toEqual([2, 3]);
    expect(new Set(result.map((b) => b.tagName)).size).toBe(2);
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

describe('sanitizeTagName', () => {
  it('strips non-alphanumeric characters', () => {
    expect(sanitizeTagName('P5-barcode')).toBe('P5barcode');
  });
  it('falls back to "Tag" for empty input', () => {
    expect(sanitizeTagName('---')).toBe('Tag');
  });
});
