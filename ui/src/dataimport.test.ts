import { expect, test } from 'vitest';
import * as fsp from 'node:fs/promises';
import { readFileForImport } from './dataimport';

test.for([{ file: 'test_assets/test_table.xlsx' }, { file: 'test_assets/test_table.csv' }])(
  'simple test for $file',
  async ({ file }, { expect }) => {
    const content = await fsp.readFile(file);
    const result = readFileForImport(content);
    expect(result).toMatchObject({
      missingHeaders: 1,
      emptyColumns: 1,
      emptyRowsRemoved: 2,
      malformedRowsRemoved: 0
    });
    expect(result.data.columns).toStrictEqual([
      { header: 'Sample', type: 'String' },
      { header: 'ColA', type: 'Long' },
      { header: 'ColB', type: 'String' },
      { header: 'ColC', type: 'Double' },
      { header: 'ColD', type: 'String' },
      { header: 'ColE', type: 'String' }
    ]);
    const s4 = result.data.rows.find((r) => r[0] === 'S4');
    const s5 = result.data.rows.find((r) => r[0] === 'S5');
    expect(s4).toStrictEqual(['S4', 1, '2', 112.3221, '112.3221', undefined]);
    expect(s5).toStrictEqual(['S5', undefined, 'asd', 112.3221, '112.3221', 'asd']);
  }
);
