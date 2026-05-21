import type { ImportResult } from '../dataimport';

export const TAG_NAME_RX = /^[A-Za-z0-9]+$/;

export type TagBinding = { tagName: string; columnIdx: number };

// Reverse-direction match (tag includes header) needs a header-length floor.
// A 2-3 char header like 'ID' (norm 'id') would otherwise substring-match
// every longer declared tag ending in those chars. Four excludes the obvious
// noise ('id', 'p5', 'p7') while keeping headers like 'Barcode' (7 chars)
// matching a declared 'BarcodeID' on re-import.
const MIN_REVERSE_HEADER_LEN = 4;

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

  // Sort longest-first so overlapping tags match the most specific one:
  // without this, 'i7' shadows 'i7_index' when both are declared.
  const sortedTags = [...declaredTags].sort((a, b) => b.length - a.length);

  // Strip non-alphanumeric before matching so a 'BarcodeID' declared tag
  // resolves against a 'Barcode ID' header on re-import. The empty-string
  // guard keeps a pathological tag like '-' from substring-matching every
  // header.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Bind columns matching a declared tag (alphanumeric, case-insensitive substring).
  // Containment is bidirectional so a short header like 'Barcode' still matches
  // a longer declared tag like 'BarcodeID' on re-import — the asymmetric
  // direction was a failure mode the fresh-dataset fallback could create.
  // MIN_REVERSE_HEADER_LEN floors the reverse direction.
  for (let i = 0; i < cols.length; i++) {
    if (i === fileIdx || i === sampleIdx) continue;
    const headerNorm = norm(cols[i].header);
    const matchedTag = sortedTags.find((t) => {
      const tagNorm = norm(t);
      if (tagNorm === '') return false;
      return headerNorm.includes(tagNorm)
        || (headerNorm.length >= MIN_REVERSE_HEADER_LEN && tagNorm.includes(headerNorm));
    });
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
