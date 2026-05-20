import type { ImportResult } from '../dataimport';

export const TAG_NAME_RX = /^[A-Za-z0-9]+$/;

export type TagBinding = { tagName: string; columnIdx: number };

/**
 * Build one binding per non-File / non-Sample column whose header matches an
 * already-declared barcode tag (case-insensitive substring). Columns that
 * do not match a declared tag flow through the metadata pipeline.
 *
 * On a fresh dataset (no declared tags), as a fallback for the single-
 * Barcode-ID flow used by demultiplexing blocks, the first column whose
 * header contains `barcode` (case-insensitive) is auto-bound as a
 * `BarcodeID` tag.
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

  // Bind columns matching a declared tag (case-insensitive substring).
  // Potential issue: substring match returns first-found in array order. If
  // declared tags overlap (e.g. ['i7', 'i7_index']) the shorter tag can
  // shadow the longer one — sort by length desc if this becomes real.
  for (let i = 0; i < cols.length; i++) {
    if (i === fileIdx || i === sampleIdx) continue;
    const header = cols[i].header;
    const matchedTag = declaredTags.find((t) => header.toLowerCase().includes(t.toLowerCase()));
    if (!matchedTag) continue;
    let tagName = matchedTag;
    let n = 2;
    while (taken.has(tagName)) {
      tagName = `${matchedTag}${n}`;
      n++;
    }
    taken.add(tagName);
    result.push({ tagName, columnIdx: i });
  }

  // Fallback for the single-Barcode-ID flow: on a fresh dataset (no declared
  // tags) where the samplesheet has any column whose header contains
  // `barcode` (case-insensitive), pre-bind the first such column as a
  // `BarcodeID` tag. Matches the V3 migration's seed convention so
  // downstream identifiers stay consistent with legacy projects.
  if (result.length === 0 && declaredTags.length === 0) {
    for (let i = 0; i < cols.length; i++) {
      if (i === fileIdx || i === sampleIdx) continue;
      if (cols[i].header.toLowerCase().includes('barcode')) {
        result.push({ tagName: 'BarcodeID', columnIdx: i });
        break;
      }
    }
  }

  return result;
}
