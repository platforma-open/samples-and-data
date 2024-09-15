import { test } from 'vitest';
import { buildWrappedString, FileNamePattern, inferFileNamePattern } from './file_name_parser';

test.for([
  {
    pattern: '{{s}}{{R}}.fastq.gz',
    target: 'FebControl10_sampled_R2.fastq.gz',
    match: {
      sample: {
        value: 'FebControl10_sampled'
      },
      readIndex: {
        value: 'R2'
      }
    }
  },
  {
    pattern: '{{s}}{{R}}.fastq.gz',
    target: 'FebControl10_sampled_R2.fastqagz',
    match: undefined
  },
  {
    pattern: '{{s}}{{R}}_L{{n}}.fastq.gz',
    target: 'FebControl10_sampled_R2_L002.fastq.gz',
    match: {
      sample: {
        value: 'FebControl10_sampled'
      },
      readIndex: {
        value: 'R2'
      },
      anyNumberMatchers: [{ value: '002' }]
    }
  },
  {
    pattern: '{{s}}{{RR}}_L{{n}}.fastq.gz',
    target: 'FebControl10_sampled_R2_L002.fastq.gz',
    match: {
      sample: {
        value: 'FebControl10_sampled'
      },
      readIndex: {
        value: 'R2'
      },
      anyNumberMatchers: [{ value: '002' }]
    }
  },
  {
    pattern: '{{s}}{{R}}L{{n}}.fastq.gz',
    target: 'FebControl10_sampled_R2_L002.fastq.gz',
    match: {
      sample: {
        value: 'FebControl10_sampled'
      },
      readIndex: {
        value: 'R2'
      }
    }
  },
  {
    pattern: '{{s}}{{R}}.fastq',
    target: 'FebControl10_sampled_R2.fastq.gz',
    match: undefined
  }
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
    anyNumberMatchers: { begin: '\\', end: '/' }
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
    anyNumberMatchers: { begin: '\\', end: '/' }
  });
  expect(wrapped).to.equal(`[FebControl10_sampled]_{R2}_L\\002/.fastq.gz`);
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
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_R2_001.fastq.gz'
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
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_R2.fastq.gz'
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
    '10k_PBMC_5pv2_nextgem_Chromium_Controller_gex_2_S5_L004_R2.fastq.gz'
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
    'ERR2618746_2.fastq.gz'
  ];
  const result = inferFileNamePattern(fileNames);
  expect(result?.pattern.rawPattern).to.equal('{{Sample}}_{{R}}.fastq.gz');
  expect(result?.extension).to.equal('fastq.gz');
  expect(result?.readIndices).to.toMatchObject(['R1', 'R2']);
});
