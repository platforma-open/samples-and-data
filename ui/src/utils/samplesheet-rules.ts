import type { BarcodeRule, PlId } from '@platforma-open/milaboratories.samples-and-data.model';

/**
 * Merge a samplesheet's declared tag set into the dataset's existing tag list.
 * Returns the union (preserving the dataset's existing order, with new tags
 * appended) and the subset that was newly introduced.
 */
export function mergeDeclaredTags(
  existingTags: readonly string[],
  declaredTags: readonly string[],
): { updatedTags: string[]; newTags: string[] } {
  const newTags = declaredTags.filter((t) => !existingTags.includes(t));
  const updatedTags = newTags.length > 0 ? [...existingTags, ...newTags] : [...existingTags];
  return { updatedTags, newTags };
}

/**
 * Backfill an empty value for every newly introduced tag on every pre-existing
 * rule so the `(rules, tags)` invariant holds after a samplesheet import that
 * brings in new tags.
 */
export function backfillExistingRules(
  rules: readonly BarcodeRule[],
  newTags: readonly string[],
): BarcodeRule[] {
  if (newTags.length === 0) return [...rules];
  return rules.map((rule) => {
    const patch: Record<string, string> = {};
    for (const t of newTags) patch[t] = '';
    return { ...rule, barcodes: { ...rule.barcodes, ...patch } };
  });
}

/**
 * Build a barcode rule from a samplesheet row, applying Option B semantics
 * from `docs/text/work/ad-hoc/sd-samplesheet-tag-backfill-asymmetry.md`:
 * a rule is only created when the row covers every declared tag with a
 * non-empty value. Mirrors what `multiplexing-rules-validation` enforces at
 * `args` time, so a pushed rule is well-formed and the block stays runnable.
 *
 * Returns `null` when the row should not produce a new rule. The sample is
 * still assigned to its file group and its metadata still flows through —
 * only the rule append is skipped. The dialog's import summary signals which
 * declared tags were not covered.
 */
export function buildRuleFromRow(args: {
  row: { barcodes?: Record<string, string> };
  updatedTags: readonly string[];
  groupId: PlId;
  sampleId: PlId;
  mintRuleId: () => string;
}): BarcodeRule | null {
  const { row, updatedTags, groupId, sampleId, mintRuleId } = args;
  if (updatedTags.length === 0) return null;
  const coversAllTags = updatedTags.every(
    (t) => (row.barcodes?.[t] ?? '') !== '',
  );
  if (!coversAllTags) return null;
  const barcodes: Record<string, string> = {};
  for (const t of updatedTags) barcodes[t] = row.barcodes?.[t] ?? '';
  return {
    ruleId: mintRuleId(),
    sampleGroupId: groupId,
    sampleId,
    barcodes,
  };
}
