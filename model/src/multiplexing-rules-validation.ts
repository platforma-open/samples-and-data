import type { PlId } from '@platforma-sdk/model';
import type { DSAny, DSMultiplexedFastq } from './args';

export type MultiplexingRuleIssueSeverity = 'error' | 'warn';

export interface MultiplexingRuleIssue {
  severity: MultiplexingRuleIssueSeverity;
  message: string;
  datasetId: PlId;
  datasetLabel: string;
}

function isMultiplexedFastq(ds: DSAny): ds is DSMultiplexedFastq {
  return ds.content.type === 'MultiplexedFastq';
}

export function validateMultiplexingRulesDataset(
  dataset: DSMultiplexedFastq,
  sampleLabels: Record<PlId, string>,
): MultiplexingRuleIssue[] {
  const out: MultiplexingRuleIssue[] = [];
  const tags = dataset.content.barcodeTags;
  const rules = dataset.content.barcodeRules;
  const groupIds = new Set(Object.keys(dataset.content.data));
  const meta = { datasetId: dataset.id, datasetLabel: dataset.label };

  if (tags.length > 0) {
    let emptyCount = 0;
    for (const r of rules) {
      for (const t of tags) {
        if ((r.barcodes[t] ?? '') === '') emptyCount++;
      }
    }
    if (emptyCount > 0) {
      out.push({
        ...meta,
        severity: 'error',
        message: `${emptyCount} empty barcode value${emptyCount === 1 ? '' : 's'} in the rules table.`,
      });
    }
  }

  if (tags.length > 0 && rules.length > 0) {
    const byGroup = new Map<string, Map<string, Set<string>>>();
    for (const r of rules) {
      const key = tags.map((t) => `${t}=${r.barcodes[t] ?? ''}`).join('|');
      let g = byGroup.get(r.sampleGroupId);
      if (!g) { g = new Map(); byGroup.set(r.sampleGroupId, g); }
      let s = g.get(key);
      if (!s) { s = new Set(); g.set(key, s); }
      s.add(r.sampleId);
    }
    const collisions: string[] = [];
    for (const [gid, m] of byGroup) {
      for (const [, sIds] of m) {
        if (sIds.size > 1) {
          const groupLabel = dataset.content.groupLabels[gid as PlId] ?? gid;
          const sampleNames = [...sIds].map((sid) => sampleLabels[sid as PlId] ?? sid);
          collisions.push(`${groupLabel}: ${sampleNames.join(', ')}`);
        }
      }
    }
    if (collisions.length > 0) {
      out.push({
        ...meta,
        severity: 'warn',
        message: `Same barcodes assigned to different samples in the same group — ${collisions.join('; ')}.`,
      });
    }
  }

  if (tags.length > 0) {
    const groupsWithRules = new Set(rules.map((r) => r.sampleGroupId));
    const missing = [...groupIds].filter((g) => !groupsWithRules.has(g as PlId));
    if (missing.length > 0) {
      const labels = missing.map((g) => dataset.content.groupLabels[g as PlId] ?? g);
      out.push({
        ...meta,
        severity: 'warn',
        message: `${missing.length} file group${missing.length === 1 ? '' : 's'} without rules: ${labels.join(', ')}.`,
      });
    }
  }

  const rulesUnknownGroups = new Set<string>();
  for (const r of rules) {
    if (!groupIds.has(r.sampleGroupId)) rulesUnknownGroups.add(r.sampleGroupId);
  }
  if (rulesUnknownGroups.size > 0) {
    out.push({
      ...meta,
      severity: 'warn',
      message: `${rulesUnknownGroups.size} rule${rulesUnknownGroups.size === 1 ? '' : 's'} reference unknown file groups.`,
    });
  }

  return out;
}

export function validateMultiplexingRules(
  datasets: DSAny[],
  sampleLabels: Record<PlId, string>,
): MultiplexingRuleIssue[] {
  const out: MultiplexingRuleIssue[] = [];
  for (const ds of datasets) {
    if (isMultiplexedFastq(ds)) {
      out.push(...validateMultiplexingRulesDataset(ds, sampleLabels));
    }
  }
  return out;
}
