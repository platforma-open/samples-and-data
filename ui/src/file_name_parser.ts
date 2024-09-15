function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  anyMatchers: T[];
  anyNumberMatchers: T[];
};

function getMatch(rMatch: RegExpMatchArray, idx: number): Match {
  const [from, to] = rMatch.indices![idx];
  return {
    value: rMatch[idx],
    from,
    to
  };
}

type FileNamePatternParsingOps = {
  requireReadIndex?: boolean;
  requireLane?: boolean;
};

export type FileNamePatternMatch = FileNameGroups<Match>;

export class FileNamePattern {
  private constructor(
    private readonly pattern: RegExp,
    private readonly groups: FileNameGroups<number>,
    public readonly rawPattern: string,
    public readonly rawPatternElements: FileNameGroups<Range>
  ) {}

  public get hasReadIndexMatcher() {
    return this.groups.readIndex !== undefined;
  }

  public get hasLaneMatcher() {
    return this.groups.lane !== undefined;
  }

  public match(fileName: string): FileNamePatternMatch | undefined {
    const match = fileName.match(this.pattern);
    if (!match) return undefined;
    const result: FileNamePatternMatch = {
      sample: getMatch(match, this.groups.sample),
      anyMatchers: [],
      anyNumberMatchers: []
    };
    if (this.groups.readIndex !== undefined)
      result.readIndex = getMatch(match, this.groups.readIndex);
    if (this.groups.lane !== undefined) result.lane = getMatch(match, this.groups.lane);
    for (const gi of this.groups.anyMatchers) result.anyMatchers!.push(getMatch(match, gi));
    for (const gi of this.groups.anyNumberMatchers)
      result.anyNumberMatchers!.push(getMatch(match, gi));
    return result;
  }

  private static patternElement =
    /\{\{ *(:?(?<lane>l|lane)|(?<r>r)|(?<rr>rr)|(?<sample>s|sample)|(?<any>\*)|(?<anynumber>n)) *\}\}/dgi;

  public static parse(fileNamePattern: string, ops?: FileNamePatternParsingOps): FileNamePattern {
    let regexp = '^';
    let lastIndex = 0;
    let groupCounter = 1;
    let groups: Partial<FileNameGroups<number>> = { anyMatchers: [], anyNumberMatchers: [] };
    let rawElements: Partial<FileNameGroups<Range>> = { anyMatchers: [], anyNumberMatchers: [] };
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
      } else if (match.groups!['anynumber']) {
        groups.anyNumberMatchers!.push(groupCounter++);
        regexp += '([0-9]+)';
        rawElements.anyNumberMatchers!.push(range);
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
      groups as FileNameGroups<number>,
      fileNamePattern,
      rawElements as FileNameGroups<Range>
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
      result =
        result.substring(0, w.range.from) + w.wrapping.begin + result.substring(w.range.from);
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

function doWith<T, R>(v: T | undefined, op: (v: T) => R): R | undefined {
  if (v === undefined) return undefined;
  return op(v);
}

function doWith2<T1, T2, R>(
  v1: T1 | undefined,
  v2: T2 | undefined,
  op: (v1: T1, v2: T2) => R
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
  formattingOpts: FileNameFormattingOpts
): string {
  const builder = new HighlightedStringBuilder(target);
  doWith2(formattingOpts.sample, ranges.sample, singleWrappingF(builder));
  doWith2(formattingOpts.readIndex, ranges.readIndex, singleWrappingF(builder));
  doWith2(formattingOpts.lane, ranges.lane, singleWrappingF(builder));
  doWith2(formattingOpts.anyMatchers, ranges.anyMatchers, multiWrappingF(builder));
  doWith2(formattingOpts.anyNumberMatchers, ranges.anyNumberMatchers, multiWrappingF(builder));
  return builder.build();
}

export function getWellFormattedReadIndex(match: FileNameGroups<Match>): 'R1' | 'R2' {
  if (match.readIndex === undefined) return 'R1';
  const readIndex = match.readIndex.value.toUpperCase();
  if (readIndex.length === 1) return ('R' + readIndex) as 'R1' | 'R2';
  else return readIndex as 'R1' | 'R2';
}

type WellKnownPattern = {
  patternWithoutExtension: string;
  extensions: string[];
  minimalPercent: number;
};

const wellKnownPattern: WellKnownPattern[] = [
  {
    patternWithoutExtension: '{{Sample}}_L{{n}}_{{RR}}_{{n}}',
    extensions: ['fastq', 'fastq.gz'],
    minimalPercent: 0.49
  },
  {
    patternWithoutExtension: '{{Sample}}_L{{n}}_{{RR}}',
    extensions: ['fastq', 'fastq.gz'],
    minimalPercent: 0.49
  },
  {
    patternWithoutExtension: '{{Sample}}_L{{L}}_{{RR}}_{{n}}',
    extensions: ['fastq', 'fastq.gz'],
    minimalPercent: 0.49
  },
  {
    patternWithoutExtension: '{{Sample}}_L{{L}}_{{RR}}',
    extensions: ['fastq', 'fastq.gz'],
    minimalPercent: 0.49
  },
  {
    patternWithoutExtension: '{{Sample}}{{RR}}_{{n}}',
    extensions: ['fastq', 'fastq.gz'],
    minimalPercent: 0.49
  },
  {
    patternWithoutExtension: '{{Sample}}{{RR}}_L{{n}}',
    extensions: ['fastq', 'fastq.gz'],
    minimalPercent: 0.49
  },
  {
    patternWithoutExtension: '{{Sample}}_{{RR}}_{{*}}',
    extensions: ['fastq', 'fastq.gz'],
    minimalPercent: 0.9
  },
  {
    patternWithoutExtension: '{{Sample}}_{{R}}',
    extensions: ['fastq', 'fastq.gz'],
    minimalPercent: 0.9
  },
  {
    patternWithoutExtension: '{{Sample}}{{RR}}',
    extensions: ['fastq', 'fastq.gz'],
    minimalPercent: 0.9
  },
  {
    patternWithoutExtension: '{{Sample}}',
    extensions: ['fastq', 'fastq.gz', 'fasta', 'fa'],
    minimalPercent: 0.99
  }
];

export type InferFileNamePatternOps = {
  extension?: string;
  multipleReadIndices?: boolean;
};

export type InferFileNamePatternResult = {
  pattern: FileNamePattern;
  extension: string;
  readIndices: string[];
};

export function inferFileNamePattern(
  fileNames: string[],
  ops?: InferFileNamePatternOps
): InferFileNamePatternResult | undefined {
  outer: for (const wkPattern of wellKnownPattern) {
    const extensions = ops?.extension !== undefined ? [ops?.extension] : wkPattern.extensions;
    for (const extension of extensions) {
      const pattern = FileNamePattern.parse(wkPattern.patternWithoutExtension + '.' + extension);
      if (ops?.multipleReadIndices && !pattern.hasReadIndexMatcher) continue outer;
      let matchedFiles = 0;
      const readIndices = pattern.hasReadIndexMatcher ? new Set<string>() : undefined;
      const samples = new Set<string>();
      for (const file of fileNames) {
        const match = pattern.match(file);
        if (match !== undefined) {
          let sample = match.sample.value;
          if (match.lane) sample += '___' + match.lane.value;
          if (match.readIndex) sample += '___' + match.readIndex.value;
          if (samples.has(sample)) continue outer;
          samples.add(sample);
          matchedFiles++;
          if (readIndices !== undefined) readIndices.add(getWellFormattedReadIndex(match));
        }
      }
      if (matchedFiles / fileNames.length > wkPattern.minimalPercent)
        return {
          pattern,
          extension,
          readIndices: readIndices === undefined ? ['R1'] : [...readIndices].sort()
        };
    }
  }
  return undefined;
}
