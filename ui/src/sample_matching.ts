export type SampleMatchingAlgorithm = {
  name: string;
  matcher: (existingSample: string, importSample: string) => boolean;
};

const SampleMatchingAlgorithms: SampleMatchingAlgorithm[] = [
  {
    name: 'Perfect match',
    matcher: (existingSample, importSample) => existingSample === importSample
  },
  {
    name: 'Existing sample name starts with import sample name',
    matcher: (existingSample, importSample) => existingSample.startsWith(importSample)
  },
  {
    name: 'Existing sample name ends with import sample name',
    matcher: (existingSample, importSample) => existingSample.endsWith(importSample)
  },
  {
    name: 'Existing sample name starts with import sample name (with trimming)',
    matcher: (existingSample, importSample) => existingSample.trim().startsWith(importSample.trim())
  },
  {
    name: 'Existing sample name ends with import sample name (with trimming)',
    matcher: (existingSample, importSample) => existingSample.trim().endsWith(importSample.trim())
  },
  {
    name: 'Import sample name starts with existing sample name',
    matcher: (existingSample, importSample) => importSample.startsWith(existingSample)
  },
  {
    name: 'Import sample name ends with existing sample name',
    matcher: (existingSample, importSample) => importSample.endsWith(existingSample)
  },
  {
    name: 'Import sample name starts with existing sample name (with trimming)',
    matcher: (existingSample, importSample) => importSample.trim().startsWith(existingSample.trim())
  },
  {
    name: 'Import sample name ends with existing sample name (with trimming)',
    matcher: (existingSample, importSample) => importSample.trim().endsWith(existingSample.trim())
  },
  {
    name: 'Existing sample name contains import sample name',
    matcher: (existingSample, importSample) => existingSample.includes(importSample)
  },
  {
    name: 'Existing sample name contains import sample name (with trimming)',
    matcher: (existingSample, importSample) => existingSample.includes(importSample.trim())
  },
  {
    name: 'Import sample name contains existing sample name',
    matcher: (existingSample, importSample) => importSample.includes(existingSample)
  },
  {
    name: 'Import sample name contains existing sample name (with trimming)',
    matcher: (existingSample, importSample) => importSample.includes(existingSample.trim())
  }
];

export function determineBestMatchingAlgorithm(
  existingSamples: string[],
  importSamples: string[]
): SampleMatchingAlgorithm {
  if (existingSamples.length === 0) return SampleMatchingAlgorithms[0];
  let topAlgorithm: SampleMatchingAlgorithm = SampleMatchingAlgorithms[0];
  let topAlgorithmScore: number = -1;
  algLoop: for (const alg of SampleMatchingAlgorithms) {
    const matchedExistingSamples = new Set<number>();
    for (let iIdx = 0; iIdx < importSamples.length; ++iIdx) {
      let iMatched = false;
      for (let eIdx = 0; eIdx < existingSamples.length; ++eIdx) {
        if (alg.matcher(existingSamples[eIdx], importSamples[iIdx])) {
          if (matchedExistingSamples.has(eIdx) || iMatched)
            // ambiguous match
            continue algLoop;
          iMatched = true;
          matchedExistingSamples.add(eIdx);
        }
      }
    }

    if (topAlgorithmScore < matchedExistingSamples.size) {
      topAlgorithm = alg;
      topAlgorithmScore = matchedExistingSamples.size;
    }
  }

  return topAlgorithm;
}
