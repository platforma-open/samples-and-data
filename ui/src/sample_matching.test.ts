import { test } from 'vitest';
import { determineBestMatchingAlgorithm } from './sample_matching';

test.for([
  {
    existingNames: ['Sample1', 'SampleB', 'SampleC'],
    importNames: ['Sample1', 'SampleB'],
    expectedAlgorithm: 'Perfect match',
  },
  {
    existingNames: ['Sample1', 'SampleB'],
    importNames: ['Sample1', 'SampleB', 'SampleC'],
    expectedAlgorithm: 'Perfect match',
  },
  {
    existingNames: ['Sample1_suffix', 'SampleB_suffix'],
    importNames: ['Sample1', 'SampleB', 'SampleC'],
    expectedAlgorithm: 'Existing sample name starts with',
  },
  {
    existingNames: ['Sample1', 'SampleB'],
    importNames: ['Sample1_suffix', 'SampleB_suffix', 'SampleC_suffix'],
    expectedAlgorithm: 'Import sample name starts with',
  },
  {
    existingNames: ['Sample1', 'SampleB'],
    importNames: ['asdd_Sample1_suffix', 'SampleB_suffix', 'SampleC_suffix'],
    expectedAlgorithm: 'Import sample name contains',
  },
  {
    existingNames: ['sad_Sample1', 'SampleB_asdd'],
    importNames: ['Sample1', 'SampleB', 'SampleC'],
    expectedAlgorithm: 'Existing sample name contains',
  },
])(
  'simple best algorithm test $expectedAlgorithm',
  ({ existingNames, importNames, expectedAlgorithm }, { expect }) => {
    const algo = determineBestMatchingAlgorithm(existingNames, importNames);
    expect(algo.topAlgorithm.name).contain(expectedAlgorithm);
  },
);
