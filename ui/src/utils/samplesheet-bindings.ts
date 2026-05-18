import type { ImportResult } from '../dataimport';

export const TAG_NAME_RX = /^[A-Za-z0-9]+$/;

export type TagBinding = { tagName: string; columnIdx: number };

export function sanitizeTagName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : 'Tag';
}

/**
 * Build one binding per non-File / non-Sample column **whose header matches an
 * already-declared barcode tag** (case-insensitive substring match). Columns
 * that do not match a declared tag are intentionally left out so they flow
 * through the metadata pipeline as before. Operators can still attach a
 * binding manually from the dialog if they want to introduce a new tag.
 */
export function defaultBindingsFor(
  ic: ImportResult,
  fileIdx: number,
  sampleIdx: number,
  declaredTags: string[],
): TagBinding[] {
  const cols = ic.data.columns;
  const result: TagBinding[] = [];
  const taken = new Set<string>();
  // Longest-first so `P5extra` wins over `P5` when both are declared.
  const sortedTags = [...declaredTags].sort((a, b) => b.length - a.length);
  for (let i = 0; i < cols.length; i++) {
    if (i === fileIdx || i === sampleIdx) continue;
    const header = cols[i].header;
    const matchedTag = sortedTags.find((t) =>
      header.toLowerCase().includes(t.toLowerCase()));
    if (!matchedTag) continue;
    let tagName = matchedTag;
    let n = 2;
    while (taken.has(tagName)) {
      tagName = `${sanitizeTagName(matchedTag) || 'Tag'}${n}`;
      n++;
    }
    taken.add(tagName);
    result.push({ tagName, columnIdx: i });
  }
  return result;
}

/**
 * Pick a default tag name for a manually-added binding. Mirrors
 * `defaultBindingsFor`'s matching logic: longest-first match against an
 * already-declared tag, otherwise sanitize the header. Resolves collisions
 * against `taken` with a numeric suffix.
 */
export function pickTagNameForBinding(
  header: string,
  declaredTags: string[],
  taken: Set<string>,
): string {
  const sortedTags = [...declaredTags].sort((a, b) => b.length - a.length);
  const matchedTag = sortedTags.find((t) =>
    header.toLowerCase().includes(t.toLowerCase()));
  const base = matchedTag ?? (TAG_NAME_RX.test(header) ? header : sanitizeTagName(header));
  let tagName = base;
  let n = 2;
  while (taken.has(tagName)) {
    tagName = `${sanitizeTagName(base) || 'Tag'}${n}`;
    n++;
  }
  return tagName;
}
