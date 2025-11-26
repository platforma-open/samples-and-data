import { test } from 'vitest';
import {
  buildWrappedString,
  collectReadIndices,
  FileNamePattern,
  inferFileNamePattern,
  normalizeCellRangerFileRole,
} from './file_name_parser';

test.for([
  {
    pattern: '{{s}}{{R}}.fastq.gz',
    target: 'FebControl10_sampled_R2.fastq.gz',
    match: {
      sample: {
        value: 'FebControl10_sampled',
      },
      readIndex: {
        value: 'R2',
      },
    },
  },
  {
    pattern: '{{s}}{{R}}.fastq.gz',
    target: 'FebControl10_sampled_R2.fastqagz',
    match: undefined,
  },
  {
    pattern: '{{s}}{{R}}_L{{n}}.fastq.gz',
    target: 'FebControl10_sampled_R2_L002.fastq.gz',
    match: {
      sample: {
        value: 'FebControl10_sampled',
      },
      readIndex: {
        value: 'R2',
      },
      anyNumberMatchers: [{ value: '002' }],
    },
  },
  {
    pattern: '{{s}}{{RR}}_L{{n}}.fastq.gz',
    target: 'FebControl10_sampled_R2_L002.fastq.gz',
    match: {
      sample: {
        value: 'FebControl10_sampled',
      },
      readIndex: {
        value: 'R2',
      },
      anyNumberMatchers: [{ value: '002' }],
    },
  },
  {
    pattern: '{{s}}{{n:TAG2}}_{{*:TAG1}}_{{RR}}_L{{n}}.fastq.gz',
    target: 'FebControl10_sampled_R2_L002.fastq.gz',
    match: {
      sample: {
        value: 'FebControl',
      },
      tags: {
        TAG1: { value: 'sampled' },
        TAG2: { value: '10' },
      },
      readIndex: {
        value: 'R2',
      },
      anyNumberMatchers: [{ value: '002' }],
    },
  },
  {
    pattern: '{{s}}{{R}}L{{n}}.fastq.gz',
    target: 'FebControl10_sampled_R2_L002.fastq.gz',
    match: {
      sample: {
        value: 'FebControl10_sampled',
      },
      readIndex: {
        value: 'R2',
      },
    },
  },
  {
    pattern: '{{s}}{{R}}.fastq',
    target: 'FebControl10_sampled_R2.fastq.gz',
    match: undefined,
  },
])('matching test for $pattern and $target', ({ pattern, target, match }, { expect }) => {
  const fileNamePattern = FileNamePattern.parse(pattern);
  const actualMatch = fileNamePattern.match(target);
  if (match === undefined) expect(actualMatch).toBeUndefined();
  else expect(actualMatch).to.toMatchObject(match);
});

test('wrapped string builder - pattern', ({ expect }) => {
  const fileNamePattern = FileNamePattern.parse('{{s}}{{R}}L{{n}}D{{*}}.fastq.gz');
  const wrapped = fileNamePattern.buildFormattedPattern({
    sample: { begin: '[', end: ']' },
    readIndex: { begin: '{', end: '}' },
    anyMatchers: { begin: '(', end: ')' },
    anyNumberMatchers: { begin: '\\', end: '/' },
  });
  expect(wrapped).to.equal(`[{{s}}]{{{R}}}L\\{{n}}/D({{*}}).fastq.gz`);
});

test('wrapped string builder - match', ({ expect }) => {
  const fileNamePattern = FileNamePattern.parse('{{s}}{{R}}_L{{n}}.fastq.gz');
  const target = 'FebControl10_sampled_R2_L002.fastq.gz';
  const match = fileNamePattern.match(target);
  const wrapped = buildWrappedString(target, match!, {
    sample: { begin: '[', end: ']' },
    readIndex: { begin: '{', end: '}' },
    anyMatchers: { begin: '(', end: ')' },
    anyNumberMatchers: { begin: '\\', end: '/' },
  });
  expect(wrapped).to.equal(`[FebControl10_sampled]_{R2}_L\\002/.fastq.gz`);
});

test('collectReadIndices with manual pattern', ({ expect }) => {
  const pattern = FileNamePattern.parse('{{Sample}}_L{{L}}_{{RR}}.fastq.gz');
  const fileNames = [
    'SampleA_L001_R2.fastq.gz',
    'SampleA_L001_R1.fastq.gz',
    'SampleB_L002_R1.fastq.gz',
  ];
  const readIndices = collectReadIndices(pattern, fileNames);
  expect(readIndices).to.toEqual(['R1', 'R2']);
});

test('collectReadIndices without read matcher returns empty for fasta', ({ expect }) => {
  const pattern = FileNamePattern.parse('{{Sample}}.fasta');
  const readIndices = collectReadIndices(pattern, ['SampleA.fasta', 'SampleB.fasta']);
  expect(readIndices).to.toEqual([]);
});

test('collectReadIndices without read matcher returns R1 for single fastq file', ({ expect }) => {
  const pattern = FileNamePattern.parse('{{Sample}}.fastq.gz');
  const readIndices = collectReadIndices(pattern, ['SampleA.fastq.gz']);
  expect(readIndices).to.toEqual(['R1']);
});

test('collectReadIndices returns default when no read matches found', ({ expect }) => {
  const pattern = FileNamePattern.parse('{{Sample}}_{{RR}}.fastq.gz');
  const readIndices = collectReadIndices(pattern, ['SampleA.fastq.gz']);
  expect(readIndices).to.toEqual(['R1']);
});

test('infer file name pattern 1', ({ expect }) => {
  const fileNames = [
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_I1_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_I2_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_R1_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_R2_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L002_I1_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L002_I2_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L002_R1_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L002_R2_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L003_I1_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L003_I2_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L003_R1_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L003_R2_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L004_I1_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L004_I2_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L004_R1_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L004_R2_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_I1_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_I2_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_R1_001.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_R2_001.fastq.gz',
  ];
  const result = inferFileNamePattern(fileNames);
  expect(result?.pattern.rawPattern).to.equal('{{Sample}}_L{{L}}_{{RR}}_{{n}}.fastq.gz');
  expect(result?.extension).to.equal('fastq.gz');
  expect(result?.readIndices).to.toMatchObject(['R1', 'R2']);
});

test('infer file name pattern 2', ({ expect }) => {
  const fileNames = [
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_I1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_I2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_R1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_R2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L002_I1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L002_I2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L002_R1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L002_R2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L003_I1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L003_I2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L003_R1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L003_R2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L004_I1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L004_I2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L004_R1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L004_R2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_I1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_I2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_R1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_R2.fastq.gz',
  ];
  const result = inferFileNamePattern(fileNames);
  expect(result?.pattern.rawPattern).to.equal('{{Sample}}_L{{L}}_{{RR}}.fastq.gz');
  expect(result?.extension).to.equal('fastq.gz');
  expect(result?.readIndices).to.toMatchObject(['R1', 'R2']);
});

test('infer file name pattern 3', ({ expect }) => {
  const fileNames = [
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_I1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_I2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_R1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_1_S7_L001_R2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_I1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_I2.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_R1.fastq.gz',
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_R2.fastq.gz',
  ];
  const result = inferFileNamePattern(fileNames);
  expect(result?.pattern.rawPattern).to.equal('{{Sample}}_L{{n}}_{{RR}}.fastq.gz');
  expect(result?.extension).to.equal('fastq.gz');
  expect(result?.readIndices).to.toMatchObject(['R1', 'R2']);
});

test('infer file name pattern 4', ({ expect }) => {
  const fileNames = [
    'accList.txt',
    'ERR2618735_1.fastq.gz',
    'ERR2618735_2.fastq.gz',
    'ERR2618736_1.fastq.gz',
    'ERR2618736_2.fastq.gz',
    'ERR2618737_1.fastq.gz',
    'ERR2618737_2.fastq.gz',
    'ERR2618738_1.fastq.gz',
    'ERR2618738_2.fastq.gz',
    'ERR2618739_1.fastq.gz',
    'ERR2618739_2.fastq.gz',
    'ERR2618740_1.fastq.gz',
    'ERR2618740_2.fastq.gz',
    'ERR2618741_1.fastq.gz',
    'ERR2618741_2.fastq.gz',
    'ERR2618742_1.fastq.gz',
    'ERR2618742_2.fastq.gz',
    'ERR2618743_1.fastq.gz',
    'ERR2618743_2.fastq.gz',
    'ERR2618744_1.fastq.gz',
    'ERR2618744_2.fastq.gz',
    'ERR2618745_1.fastq.gz',
    'ERR2618745_2.fastq.gz',
    'ERR2618746_1.fastq.gz',
    'ERR2618746_2.fastq.gz',
  ];
  const result = inferFileNamePattern(fileNames);
  expect(result?.pattern.rawPattern).to.equal('{{Sample}}_{{R}}.fastq.gz');
  expect(result?.extension).to.equal('fastq.gz');
  expect(result?.readIndices).to.toMatchObject(['R1', 'R2']);
});

test('infer file name pattern 5', ({ expect }) => {
  const fileNames = [
    'accList.txt',
    'seq1.fasta',
    'seq2.fasta',
    'seq3.fasta',
    'seq4.fasta',
    'seq5.fasta',
    'seq6.fasta',
    'seq7.fasta',
    'seq8.fasta',
    'seq11.fasta',
    'seq12.fasta',
    'seq13.fasta',
    'seq14.fasta',
    'seq15.fasta',
    'seq16.fasta',
    'seq17.fasta',
    'seq18.fasta',
  ];
  const result = inferFileNamePattern(fileNames);
  expect(result?.pattern.rawPattern).to.equal('{{Sample}}.fasta');
  expect(result?.extension).to.equal('fasta');
  expect(result?.readIndices).to.toMatchObject([]);
});

test.for([
  {
    pattern: '{{Sample}}_{{CellRangerFileRole}}.gz',
    target: 'GSM7891404_PBS-1_matrix.mtx.gz',
    match: {
      sample: {
        value: 'GSM7891404_PBS-1',
      },
      cellRangerFileRole: {
        value: 'matrix.mtx',
      },
    },
  },
  {
    pattern: '{{Sample}}_{{CellRangerFileRole}}.gz',
    target: 'GSM7891404_PBS-1_features.tsv.gz',
    match: {
      sample: {
        value: 'GSM7891404_PBS-1',
      },
      cellRangerFileRole: {
        value: 'features.tsv',
      },
    },
  },
  {
    pattern: '{{Sample}}_{{CellRangerFileRole}}.gz',
    target: 'GSM7891404_PBS-1_barcodes.tsv.gz',
    match: {
      sample: {
        value: 'GSM7891404_PBS-1',
      },
      cellRangerFileRole: {
        value: 'barcodes.tsv',
      },
    },
  },
  {
    pattern: '{{Sample}}_{{CellRangerFileRole}}.gz',
    target: 'GSM7891412_sEV-3_genes.tsv.gz',
    match: {
      sample: {
        value: 'GSM7891412_sEV-3',
      },
      cellRangerFileRole: {
        value: 'genes.tsv',
      },
    },
  },
  {
    pattern: '{{Sample}}-{{CellRangerFileRole}}',
    target: 'sample1-matrix.mtx',
    match: {
      sample: {
        value: 'sample1',
      },
      cellRangerFileRole: {
        value: 'matrix.mtx',
      },
    },
  },
  {
    pattern: '{{Sample}}_{{CellRangerFileRole}}',
    target: 'sample1_features.tsv',
    match: {
      sample: {
        value: 'sample1',
      },
      cellRangerFileRole: {
        value: 'features.tsv',
      },
    },
  },
  {
    pattern: '{{Sample}}_{{CellRangerFileRole}}.gz',
    target: 'sample1_invalid.txt.gz',
    match: undefined,
  },
])('CellRanger MTX matching test for $pattern and $target', ({ pattern, target, match }, { expect }) => {
  const fileNamePattern = FileNamePattern.parse(pattern);
  const actualMatch = fileNamePattern.match(target);
  if (match === undefined) expect(actualMatch).toBeUndefined();
  else expect(actualMatch).to.toMatchObject(match);
});

test('normalizeCellRangerFileRole - genes.tsv to features.tsv', ({ expect }) => {
  expect(normalizeCellRangerFileRole('genes.tsv')).to.equal('features.tsv');
});

test('normalizeCellRangerFileRole - features.tsv unchanged', ({ expect }) => {
  expect(normalizeCellRangerFileRole('features.tsv')).to.equal('features.tsv');
});

test('normalizeCellRangerFileRole - matrix.mtx unchanged', ({ expect }) => {
  expect(normalizeCellRangerFileRole('matrix.mtx')).to.equal('matrix.mtx');
});

test('normalizeCellRangerFileRole - barcodes.tsv unchanged', ({ expect }) => {
  expect(normalizeCellRangerFileRole('barcodes.tsv')).to.equal('barcodes.tsv');
});

test('infer CellRanger MTX pattern - compressed with underscore', ({ expect }) => {
  const fileNames = [
    'GSM7891404_PBS-1_matrix.mtx.gz',
    'GSM7891404_PBS-1_features.tsv.gz',
    'GSM7891404_PBS-1_barcodes.tsv.gz',
    'GSM7891405_PBS-2_matrix.mtx.gz',
    'GSM7891405_PBS-2_features.tsv.gz',
    'GSM7891405_PBS-2_barcodes.tsv.gz',
    'GSM7891406_PBS-3_matrix.mtx.gz',
    'GSM7891406_PBS-3_features.tsv.gz',
    'GSM7891406_PBS-3_barcodes.tsv.gz',
  ];
  const result = inferFileNamePattern(fileNames);
  expect(result?.pattern.rawPattern).to.equal('{{Sample}}_{{CellRangerFileRole}}.gz');
  expect(result?.extension).to.equal('gz');
  expect(result?.readIndices).to.toEqual([]);
});

test('infer CellRanger MTX pattern - compressed with genes.tsv', ({ expect }) => {
  const fileNames = [
    'GSM7891410_sEV-1_matrix.mtx.gz',
    'GSM7891410_sEV-1_genes.tsv.gz',
    'GSM7891410_sEV-1_barcodes.tsv.gz',
    'GSM7891411_sEV-2_matrix.mtx.gz',
    'GSM7891411_sEV-2_genes.tsv.gz',
    'GSM7891411_sEV-2_barcodes.tsv.gz',
    'GSM7891412_sEV-3_matrix.mtx.gz',
    'GSM7891412_sEV-3_genes.tsv.gz',
    'GSM7891412_sEV-3_barcodes.tsv.gz',
  ];
  const result = inferFileNamePattern(fileNames);
  expect(result?.pattern.rawPattern).to.equal('{{Sample}}_{{CellRangerFileRole}}.gz');
  expect(result?.extension).to.equal('gz');
  expect(result?.readIndices).to.toEqual([]);
});

test('infer CellRanger MTX pattern - uncompressed', ({ expect }) => {
  const fileNames = [
    'sample1_matrix.mtx',
    'sample1_features.tsv',
    'sample1_barcodes.tsv',
    'sample2_matrix.mtx',
    'sample2_features.tsv',
    'sample2_barcodes.tsv',
    'sample3_matrix.mtx',
    'sample3_features.tsv',
    'sample3_barcodes.tsv',
  ];
  const result = inferFileNamePattern(fileNames);
  expect(result?.pattern.rawPattern).to.equal('{{Sample}}_{{CellRangerFileRole}}');
  expect(result?.extension).to.equal('');
  expect(result?.readIndices).to.toEqual([]);
});

test('infer CellRanger MTX pattern - dash separator', ({ expect }) => {
  const fileNames = [
    'sample-1-matrix.mtx.gz',
    'sample-1-features.tsv.gz',
    'sample-1-barcodes.tsv.gz',
    'sample-2-matrix.mtx.gz',
    'sample-2-features.tsv.gz',
    'sample-2-barcodes.tsv.gz',
  ];
  const result = inferFileNamePattern(fileNames);
  expect(result?.pattern.rawPattern).to.equal('{{Sample}}-{{CellRangerFileRole}}.gz');
  expect(result?.extension).to.equal('gz');
  expect(result?.readIndices).to.toEqual([]);
});

test('CellRanger MTX pattern properties', ({ expect }) => {
  const pattern = FileNamePattern.parse('{{Sample}}_{{CellRangerFileRole}}.gz');
  expect(pattern.hasCellRangerFileRoleMatcher).to.equal(true);
  expect(pattern.hasReadIndexMatcher).to.equal(false);
  expect(pattern.hasLaneMatcher).to.equal(false);
  expect(pattern.datasetType).to.equal('CellRangerMTX');
  expect(pattern.gzipped).to.equal(true);
  expect(pattern.fileContentType).to.equal('CellRangerMTX');
});
