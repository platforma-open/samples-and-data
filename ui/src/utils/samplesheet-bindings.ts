import type { ImportResult } from '../dataimport';

export const TAG_NAME_RX = /^[A-Za-z0-9]+$/;

export type TagBinding = { tagName: string; columnIdx: number };

export function sanitizeTagName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : 'Tag';
}

/**
 * Build one binding per non-File/non-Sample column, using the column header
 * (sanitized) as the default tag name. For columns that match an
 * already-declared tag (case-insensitive substring), reuse that tag name.
 * Operator removes any binding they don't want as a barcode tag — those
 * columns then flow through the metadata pipeline as before.
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
  for (let i = 0; i < cols.length; i++) {
    if (i === fileIdx || i === sampleIdx) continue;
    const header = cols[i].header;
    const matchedTag = declaredTags.find((t) => header.toLowerCase().includes(t.toLowerCase()));
    let tagName = matchedTag ?? (TAG_NAME_RX.test(header) ? header : sanitizeTagName(header));
    let n = 2;
    while (taken.has(tagName)) {
      tagName = `${sanitizeTagName(header) || 'Tag'}${n}`;
      n++;
    }
    taken.add(tagName);
    result.push({ tagName, columnIdx: i });
  }
  return result;
}
