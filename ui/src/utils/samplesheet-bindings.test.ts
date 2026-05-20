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

describe('defaultBindingsFor (origin/main behavior — characterization)', () => {
  // This test locks in the buggy behavior on origin/main so the change in the
  // next task makes the bug visible as a test failure. Remove or rewrite when
  // Edit 1 lands.
  it('CURRENT BUG: binds every non-File / non-Sample column even with no declared tags', () => {
    const result = defaultBindingsFor(
      ic(['File', 'Sample', 'Condition', 'Treatment']),
      0, 1, [],
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ tagName: 'Condition', columnIdx: 2 });
    expect(result[1]).toEqual({ tagName: 'Treatment', columnIdx: 3 });
  });
});
