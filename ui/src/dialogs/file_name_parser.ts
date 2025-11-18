import type { DSType } from '@platforma-open/milaboratories.samples-and-data.model';
import * as _ from 'radashi';
import { escapeRegExp } from '../util';

/** Derived from file extension */
export type FileContentType = 'Fastq' | 'Fasta' | 'Xsv' | 'CellRangerMTX' | 'H5AD' | 'Seurat';

function extractFileContentType(pattern: string): FileContentType {
  if (pattern.includes('CellRangerFileRole'))
    return 'CellRangerMTX';

  let pt = pattern;
  if (pt.endsWith('.gz'))
    pt = pt.substring(0, pt.length - 3);
  if (['fastq', 'fq'].some((fq) => pt.endsWith(fq)))
    return 'Fastq';
  else if (['fasta', 'fa'].some((fa) => pt.endsWith(fa)))
    return 'Fasta';
  else if (['csv', 'tsv'].some((xs) => pt.endsWith(xs)))
    return 'Xsv';
  else if (['h5ad', 'h5'].some((h5) => pt.endsWith(h5)))
    return 'H5AD';
  else if (['rds', 'RDS'].some((rds) => pt.endsWith(rds)))
    return 'Seurat';
  else if (pt.endsWith('matrix.mtx') || pt.endsWith('features.tsv') || pt.endsWith('genes.tsv') || pt.endsWith('barcodes.tsv'))
    return 'CellRangerMTX';
  else
    throw new Error(`Unknown file content type: ${pt}`);
}

export type Range = {
  from: number;
  to: number;
};

export type Match = Range & {
  value: string;
};

export type FileNameGroups<T> = {
  sample: T;
  readIndex?: T;
  lane?: T;
  cellRangerFileRole?: T;
  tags?: Record<string, T>;
  anyMatchers: T[];
  anyNumberMatchers: T[];
};

function getMatch(rMatch: RegExpMatchArray, idx: number): Match {
  const [from, to] = rMatch.indices![idx];
  return {
    value: rMatch[idx],
    from,
    to,
  };
}

type FileNamePatternParsingOps = {
  requireReadIndex?: boolean;
  requireLane?: boolean;
};

export type FileNamePatternMatch = FileNameGroups<Match>;

export class FileNamePattern {
  public readonly tags: string[];

  private constructor(
    private readonly pattern: RegExp,
    public readonly fileContentType: FileContentType,
    private readonly groups: FileNameGroups<number>,
    public readonly rawPattern: string,
    public readonly rawPatternElements: FileNameGroups<Range>,
  ) {
    this.tags = this.groups.tags ? Object.keys(this.groups.tags) : [];
    this.tags.sort();
  }

  public get hasReadIndexMatcher() {
    return this.groups.readIndex !== undefined;
  }

  public get hasLaneMatcher() {
    return this.groups.lane !== undefined;
  }

  public get hasCellRangerFileRoleMatcher() {
    return this.groups.cellRangerFileRole !== undefined;
  }

  public get hasTagMatchers() {
    return this.groups.tags !== undefined && Object.keys(this.groups.tags).length > 0;
  }

  public get datasetType(): DSType | undefined {
    switch (this.fileContentType) {
      case 'Fastq':
        if (this.hasTagMatchers) {
          return 'TaggedFastq';
        } else if (this.hasLaneMatcher)
          return 'MultilaneFastq';
        else
          return 'Fastq';
      case 'Fasta':
        return 'Fasta';
      case 'H5AD':
        return 'H5AD';
      case 'Seurat':
        return 'Seurat';
      case 'CellRangerMTX':
        return 'CellRangerMTX';
      default:
        return undefined;
    }
  }

  public get gzipped(): boolean {
    return this.rawPattern.endsWith('.gz');
  }

  public match(fileName: string): FileNamePatternMatch | undefined {
    const match = fileName.match(this.pattern);
    if (!match)
      return undefined;

    const result: FileNamePatternMatch = {
      sample: getMatch(match, this.groups.sample),
      anyMatchers: [],
      anyNumberMatchers: [],
    };

    if (this.groups.readIndex !== undefined)
      result.readIndex = getMatch(match, this.groups.readIndex);
    if (this.groups.lane !== undefined)
      result.lane = getMatch(match, this.groups.lane);
    if (this.groups.cellRangerFileRole !== undefined)
      result.cellRangerFileRole = getMatch(match, this.groups.cellRangerFileRole);
    if (this.groups.tags !== undefined)
      result.tags = _.mapValues(this.groups.tags, (gi) => getMatch(match, gi));
    for (const gi of this.groups.anyMatchers)
      result.anyMatchers!.push(getMatch(match, gi));
    for (const gi of this.groups.anyNumberMatchers)
      result.anyNumberMatchers!.push(getMatch(match, gi));
    return result;
  }

  private static patternElement
    = /\{\{ *(:?(?<lane>l|lane)|(?<r>r)|(?<rr>rr)|(?<sample>s|sample)|(?<cellRangerFileRole>CellRangerFileRole)|\*?:(?<anytag>[a-zA-Z0-9_]+)|n:(?<anynumbertag>[a-zA-Z0-9_]+)|(?<any>\*)|(?<anynumber>n)) *\}\}/dgi;

  static parse(
    fileNamePattern: string,
    ops?: FileNamePatternParsingOps,
  ): FileNamePattern {
    let regexp = '^';
    let lastIndex = 0;
    let groupCounter = 1;
    const groups: Partial<FileNameGroups<number>> = {
      tags: {},
      anyMatchers: [],
      anyNumberMatchers: [],
    };
    const rawElements: Partial<FileNameGroups<Range>> = {
      tags: {},
      anyMatchers: [],
      anyNumberMatchers: [],
    };
    function appendInsert(insert: string) {
      regexp += escapeRegExp(insert);
    }
    for (const match of fileNamePattern.matchAll(FileNamePattern.patternElement)) {
      const [from, to] = match.indices![0];
      const range = { from, to };
      appendInsert(fileNamePattern.substring(lastIndex, from));
      lastIndex = to;
      if (match.groups!['r']) {
        if (groups.readIndex !== undefined)
          throw new Error(`Repeated {{R}} / {{RR}} read index matcher`);
        groups.readIndex = groupCounter++;
        regexp += '_?([rR]?[12])_?';
        rawElements.readIndex = range;
      } else if (match.groups!['rr']) {
        // stricter matcher, requiring an "R" letter to be present in the read index before the digit
        if (groups.readIndex !== undefined)
          throw new Error(`Repeated {{R}} / {{RR}} read index matcher`);
        groups.readIndex = groupCounter++;
        regexp += '_?([rR][12])_?';
        rawElements.readIndex = range;
      } else if (match.groups!['lane']) {
        if (groups.lane !== undefined) throw new Error(`Repeated {{L}} / {{Lane}} matcher`);
        groups.lane = groupCounter++;
        regexp += '([0-9]+)';
        rawElements.lane = range;
      } else if (match.groups!['sample']) {
        if (groups.sample !== undefined)
          throw new Error(`Repeated {{S}} / {{Sample}} sample name matcher`);
        groups.sample = groupCounter++;
        regexp += '(.+?)';
        rawElements.sample = range;
      } else if (match.groups!['any']) {
        groups.anyMatchers!.push(groupCounter++);
        regexp += '(.+?)';
        rawElements.anyMatchers!.push(range);
      } else if (match.groups?.['anytag']) {
        if (groups.tags === undefined) groups.tags = {};
        groups.tags[match.groups['anytag']] = groupCounter++;
        regexp += '(.+?)';
        if (rawElements.tags === undefined) rawElements.tags = {};
        rawElements.tags[match.groups['anytag']] = range;
      } else if (match.groups?.['anynumbertag']) {
        if (groups.tags === undefined) groups.tags = {};
        groups.tags[match.groups['anynumbertag']] = groupCounter++;
        regexp += '([0-9]+)';
        if (rawElements.tags === undefined) rawElements.tags = {};
        rawElements.tags[match.groups['anynumbertag']] = range;
      } else if (match.groups!['anynumber']) {
        groups.anyNumberMatchers!.push(groupCounter++);
        regexp += '([0-9]+)';
        rawElements.anyNumberMatchers!.push(range);
      } else if (match.groups!['cellRangerFileRole']) {
        if (groups.cellRangerFileRole !== undefined)
          throw new Error(`Repeated {{CellRangerFileRole}} matcher`);
        groups.cellRangerFileRole = groupCounter++;
        regexp += '(matrix\\.mtx|features\\.tsv|genes\\.tsv|barcodes\\.tsv)';
        rawElements.cellRangerFileRole = range;
      } else {
        throw new Error(`Unexpected token match: ${match[0]} in ${fileNamePattern}`);
      }
    }
    appendInsert(fileNamePattern.substring(lastIndex));
    regexp += '$';
    if (groups.sample === undefined)
      throw new Error(`No {{S}} / {{Sample}} sample name matcher in the pattern`);
    if (ops?.requireReadIndex && groups.readIndex === undefined)
      throw new Error(`No {{R}} / {{RR}} read index matcher in the pattern`);
    if (ops?.requireLane && groups.lane === undefined)
      throw new Error(`No {{L}} / {{Lane}} read index matcher in the pattern`);
    return new FileNamePattern(
      new RegExp(regexp, 'id'),
      extractFileContentType(fileNamePattern),
      groups as FileNameGroups<number>,
      fileNamePattern,
      rawElements as FileNameGroups<Range>,
    );
  }

  public buildFormattedPattern(formattingOpts: FileNameFormattingOpts): string {
    return buildWrappedString(this.rawPattern, this.rawPatternElements, formattingOpts);
  }
}

type WrappingElement = {
  range: Range;
  wrapping: Wrapping;
};

export class HighlightedStringBuilder {
  private readonly wraps: WrappingElement[] = [];

  constructor(private readonly target: string) {}

  public wrap(range: Range, wrapping: Wrapping) {
    this.wraps.push({ range, wrapping });
  }

  public build(): string {
    // sorting in reverse order, so last inserts go first
    this.wraps.sort((a, b) => {
      const ap = a.range.from;
      const bp = b.range.from;
      if (ap < bp) return 1;
      else if (ap > bp) return -1;
      else return 0;
    });
    let result = this.target;
    let lastPosition: number = NaN;
    for (const w of this.wraps) {
      if (!isNaN(lastPosition) && w.range.to > lastPosition) throw new Error('Intersecting ranges');
      lastPosition = w.range.from;
      result = result.substring(0, w.range.to) + w.wrapping.end + result.substring(w.range.to);
      result
        = result.substring(0, w.range.from) + w.wrapping.begin + result.substring(w.range.from);
    }
    return result;
  }
}

export type Wrapping = { begin: string; end: string };

export type FileNameFormattingOpts = Omit<
  Partial<FileNameGroups<Wrapping>>,
  'anyMatchers' | 'anyNumberMatchers'
> & {
  anyMatchers?: Wrapping;
  anyNumberMatchers?: Wrapping;
};

function doWith2<T1, T2, R>(
  v1: T1 | undefined,
  v2: T2 | undefined,
  op: (v1: T1, v2: T2) => R,
): R | undefined {
  if (v1 === undefined) return undefined;
  if (v2 === undefined) return undefined;
  return op(v1, v2);
}

function singleWrappingF(builder: HighlightedStringBuilder) {
  return (w: Wrapping, r: Range): void => builder.wrap(r, w);
}
function multiWrappingF(builder: HighlightedStringBuilder) {
  return (w: Wrapping, rr: Range[]): void => rr.forEach((r) => builder.wrap(r, w));
}

export function buildWrappedString(
  target: string,
  ranges: FileNameGroups<Range>,
  formattingOpts: FileNameFormattingOpts,
): string {
  const builder = new HighlightedStringBuilder(target);
  doWith2(formattingOpts.sample, ranges.sample, singleWrappingF(builder));
  doWith2(formattingOpts.readIndex, ranges.readIndex, singleWrappingF(builder));
  doWith2(formattingOpts.lane, ranges.lane, singleWrappingF(builder));
  doWith2(formattingOpts.anyMatchers, ranges.anyMatchers, multiWrappingF(builder));
  doWith2(formattingOpts.anyNumberMatchers, ranges.anyNumberMatchers, multiWrappingF(builder));
  doWith2(formattingOpts.cellRangerFileRole, ranges.cellRangerFileRole, singleWrappingF(builder));
  return builder.build();
}

export function getWellFormattedReadIndex(match: FileNameGroups<Match>): 'R1' | 'R2' {
  if (match.readIndex === undefined) return 'R1';
  const readIndex = match.readIndex.value.toUpperCase();
  if (readIndex.length === 1) return ('R' + readIndex) as 'R1' | 'R2';
  else return readIndex as 'R1' | 'R2';
}

/**
 * Collects read indices matched by a compiled pattern across provided file names.
 */
export function collectReadIndices(
  pattern: FileNamePattern,
  fileNames: string[],
): string[] {
  if (!pattern.hasReadIndexMatcher || pattern.fileContentType !== 'Fastq') return [];

  const readIndices = new Set<string>();
  for (const fileName of fileNames) {
    const match = pattern.match(fileName);
    if (match?.readIndex) readIndices.add(getWellFormattedReadIndex(match));
  }

  if (readIndices.size === 0) return ['R1'];

  return [...readIndices].sort();
}

export function normalizeCellRangerFileRole(role: string): 'matrix.mtx' | 'features.tsv' | 'barcodes.tsv' {
  if (role === 'genes.tsv') return 'features.tsv';
  if (role === 'matrix.mtx' || role === 'features.tsv' || role === 'barcodes.tsv')
    return role;
  throw new Error(`Unknown CellRanger file role: ${role}`);
}

type WellKnownPattern = {
  patternWithoutExtension: string;
  defaultReadIndices: string[];
  extensions: string[];
  minimalPercent: number;
};

const wellKnownPattern: WellKnownPattern[] = [
  {
    patternWithoutExtension: '{{Sample}}_L{{n}}_{{RR}}_{{n}}',
    defaultReadIndices: ['R1'],
    extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'],
    minimalPercent: 0.49,
  },
  {
    patternWithoutExtension: '{{Sample}}_L{{n}}_{{RR}}',
    defaultReadIndices: ['R1'],
    extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'],
    minimalPercent: 0.49,
  },
  {
    patternWithoutExtension: '{{Sample}}_L{{L}}_{{RR}}_{{n}}',
    defaultReadIndices: ['R1'],
    extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'],
    minimalPercent: 0.49,
  },
  {
    patternWithoutExtension: '{{Sample}}_L{{L}}_{{RR}}',
    defaultReadIndices: ['R1'],
    extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'],
    minimalPercent: 0.49,
  },
  {
    patternWithoutExtension: '{{Sample}}{{RR}}_{{n}}',
    defaultReadIndices: ['R1'],
    extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'],
    minimalPercent: 0.49,
  },
  {
    patternWithoutExtension: '{{Sample}}{{RR}}_L{{n}}',
    defaultReadIndices: ['R1'],
    extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'],
    minimalPercent: 0.49,
  },
  {
    patternWithoutExtension: '{{Sample}}_{{RR}}_{{*}}',
    defaultReadIndices: ['R1'],
    extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'],
    minimalPercent: 0.9,
  },
  {
    patternWithoutExtension: '{{Sample}}_{{R}}',
    defaultReadIndices: ['R1'],
    extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'],
    minimalPercent: 0.9,
  },
  {
    patternWithoutExtension: '{{Sample}}{{RR}}',
    defaultReadIndices: ['R1'],
    extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'],
    minimalPercent: 0.9,
  },
  {
    patternWithoutExtension: '{{Sample}}',
    defaultReadIndices: [], // also serves as a sign of FASTA format
    extensions: ['fasta', 'fa', 'fasta.gz', 'fa.gz'],
    minimalPercent: 0.7,
  },
  {
    patternWithoutExtension: '{{Sample}}',
    defaultReadIndices: ['R1'],
    extensions: ['fastq', 'fastq.gz', 'fq', 'fq.gz'],
    minimalPercent: 0.9,
  },
  {
    patternWithoutExtension: '{{Sample}}',
    defaultReadIndices: [],
    extensions: ['csv', 'tsv', 'csv.gz', 'tsv.gz'],
    minimalPercent: 0.9,
  },
  {
    patternWithoutExtension: '{{Sample}}_{{CellRangerFileRole}}',
    defaultReadIndices: [],
    extensions: ['gz', ''],
    minimalPercent: 0.9,
  },
  {
    patternWithoutExtension: '{{Sample}}-{{CellRangerFileRole}}',
    defaultReadIndices: [],
    extensions: ['gz', ''],
    minimalPercent: 0.9,
  },
  {
    patternWithoutExtension: '{{Sample}}',
    defaultReadIndices: [],
    extensions: ['h5ad'],
    minimalPercent: 0.9,
  },
  {
    patternWithoutExtension: '{{Sample}}',
    defaultReadIndices: [],
    extensions: ['rds', 'RDS'],
    minimalPercent: 0.9,
  },
];

export type InferFileNamePatternOps = {
  isGzipped?: boolean;
  expectedReadIndices?: string[];
};

export type InferFileNamePatternResult = {
  pattern: FileNamePattern;
  extension: string;
  readIndices: string[];
};

function setEquals<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

export function inferFileNamePattern(
  fileNames: string[],
  ops?: InferFileNamePatternOps,
): InferFileNamePatternResult | undefined {
  outer:
  for (const wkPattern of wellKnownPattern) {
    if (ops?.expectedReadIndices?.length === 0 && wkPattern.defaultReadIndices.length !== 0)
      // don't consider fasta pattern if non-zero set of read indices is expected
      continue;

    for (const extension of wkPattern.extensions) {
      if (ops?.isGzipped !== undefined && extension.endsWith('.gz') !== ops.isGzipped) continue;

      const patternStr = extension ? wkPattern.patternWithoutExtension + '.' + extension : wkPattern.patternWithoutExtension;
      const pattern = FileNamePattern.parse(patternStr);

      let matchedFiles = 0;
      const readIndices = pattern.hasReadIndexMatcher ? new Set<string>() : undefined;
      const samples = new Set<string>();
      for (const file of fileNames) {
        const match = pattern.match(file);
        if (match !== undefined) {
          let sample = match.sample.value;
          if (match.lane) sample += '___' + match.lane.value;
          if (match.readIndex) sample += '___' + match.readIndex.value;
          if (match.cellRangerFileRole) sample += '___' + match.cellRangerFileRole.value;
          if (samples.has(sample)) continue outer;
          samples.add(sample);
          matchedFiles++;
          if (readIndices !== undefined) readIndices.add(getWellFormattedReadIndex(match));
        }
      }

      const resultReadIndices
        = readIndices === undefined ? wkPattern.defaultReadIndices : [...readIndices].sort();

      if (
        ops?.expectedReadIndices !== undefined
        && !setEquals(new Set(resultReadIndices), new Set(ops.expectedReadIndices))
      )
        continue;

      if (matchedFiles / fileNames.length > wkPattern.minimalPercent)
        return {
          pattern,
          extension,
          readIndices: resultReadIndices,
        };
    }
  }
  return undefined;
}
