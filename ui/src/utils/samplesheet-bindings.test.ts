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
});
