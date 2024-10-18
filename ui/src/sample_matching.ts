import { escapeRegExp } from './util';

type MatcherFunction = (existingSample: string, importSample: string) => boolean;
export type SampleMatchingAlgorithm = {
  name: string;
  matcher: MatcherFunction;
};

function prepareString(str: string, caseInsensitive: boolean, trim: boolean) {
  if (trim) str = str.trim();
  if (caseInsensitive) str = str.toLocaleLowerCase();
  return str;
}

const rightDelimiterRegexp = '[_,\\-#$@&~\\[\\{\\(]';
const leftDelimiterRegexp = '[_,\\-#$@&~\\]\\}\\)]';

function startsWith(
  stringA: string,
  stringB: string,
  requireDelimiter: boolean,
  caseInsensitive: boolean,
  trim: boolean
): boolean {
  stringA = prepareString(stringA, caseInsensitive, trim);
  stringB = prepareString(stringB, caseInsensitive, trim);
  if (requireDelimiter)
    return stringA.match(RegExp('^' + escapeRegExp(stringB) + rightDelimiterRegexp)) !== null;
  else return stringA.startsWith(stringB);
}

function endsWith(
  stringA: string,
  stringB: string,
  requireDelimiter: boolean,
  caseInsensitive: boolean,
  trim: boolean
): boolean {
  stringA = prepareString(stringA, caseInsensitive, trim);
  stringB = prepareString(stringB, caseInsensitive, trim);
  if (requireDelimiter)
    return stringA.match(RegExp(leftDelimiterRegexp + escapeRegExp(stringB) + '$')) !== null;
  else return stringA.endsWith(stringB);
}

function contains(
  stringA: string,
  stringB: string,
  requireDelimiter: boolean,
  caseInsensitive: boolean,
  trim: boolean
): boolean {
  stringA = prepareString(stringA, caseInsensitive, trim);
  stringB = prepareString(stringB, caseInsensitive, trim);
  if (requireDelimiter)
    return (
      stringA.match(RegExp(leftDelimiterRegexp + escapeRegExp(stringB) + rightDelimiterRegexp)) !==
      null
    );
  else return stringA.includes(stringB);
}

function calculateDefaultAlgorithms(): SampleMatchingAlgorithm[] {
  const result: SampleMatchingAlgorithm[] = [];
  result.push({
    name: 'Perfect match',
    matcher: (existingSample, importSample) => existingSample === importSample
  });
  result.push({
    name: 'Match ignoring case',
    matcher: (existingSample, importSample) =>
      existingSample.toLocaleLowerCase() === importSample.toLocaleLowerCase()
  });

  for (const op of ['starts with', 'ends with', 'contains'] as const)
    for (const existingBigger of [true, false])
      for (const trim of [false, true])
        for (const caseInsensitive of [false, true])
          for (const requireDelimiter of [true, false]) {
            const baseMatcher: MatcherFunction =
              op === 'starts with'
                ? (existingSample, importSample) =>
                    startsWith(
                      existingSample,
                      importSample,
                      requireDelimiter,
                      caseInsensitive,
                      trim
                    )
                : op === 'ends with'
                ? (existingSample, importSample) =>
                    endsWith(existingSample, importSample, requireDelimiter, caseInsensitive, trim)
                : (existingSample, importSample) =>
                    contains(existingSample, importSample, requireDelimiter, caseInsensitive, trim);
            if (existingBigger)
              result.push({
                name: `Existing sample name ${op} import sample name${
                  requireDelimiter ? ' requiring delimiter at the end' : ''
                }${trim ? '; trim' : ''}${caseInsensitive ? '; case-insensitive' : ''}`,
                matcher: baseMatcher
              });
            else
              result.push({
                name: `Import sample name ${op} existing sample name${
                  requireDelimiter ? ' requiring delimiter at the end' : ''
                }${trim ? '; trim' : ''}${caseInsensitive ? '; case-insensitive' : ''}`,
                matcher: (existingSample, importSample) => baseMatcher(importSample, existingSample)
              });
          }

  return result;
}

const SampleMatchingAlgorithms: SampleMatchingAlgorithm[] = calculateDefaultAlgorithms();

export type AlgorithmSearchResult = {
  topAlgorithm: SampleMatchingAlgorithm;
  matches: number;
};

export function determineBestMatchingAlgorithm(
  existingSamples: string[],
  importSamples: string[]
): AlgorithmSearchResult {
  console.dir(existingSamples);
  console.dir(importSamples);
  if (existingSamples.length === 0)
    return { topAlgorithm: SampleMatchingAlgorithms[0], matches: 0 };
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

  return { topAlgorithm, matches: topAlgorithmScore };
}
