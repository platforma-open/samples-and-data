import type { BarcodeRule, PlId } from '@platforma-open/milaboratories.samples-and-data.model';
import { describe, expect, it } from 'vitest';
import {
  backfillExistingRules,
  buildRuleFromRow,
  mergeDeclaredTags,
} from './samplesheet-rules';

const grpA = 'grpA' as PlId;
const sampX = 'sampX' as PlId;

function rule(partial: Partial<BarcodeRule> & Pick<BarcodeRule, 'ruleId' | 'sampleGroupId' | 'sampleId'>): BarcodeRule {
  return { barcodes: {}, ...partial };
}

describe('mergeDeclaredTags', () => {
  it('returns a clone with no new tags when the samplesheet only declares existing tags', () => {
    const r = mergeDeclaredTags(['P5'], ['P5']);
    expect(r.updatedTags).toEqual(['P5']);
    expect(r.newTags).toEqual([]);
  });

  it('appends new tags after the existing ones, preserving order', () => {
    const r = mergeDeclaredTags(['P5'], ['P7']);
    expect(r.updatedTags).toEqual(['P5', 'P7']);
    expect(r.newTags).toEqual(['P7']);
  });

  it('treats tags already present as existing, not new', () => {
    const r = mergeDeclaredTags(['P5', 'P7'], ['P5', 'P9']);
    expect(r.updatedTags).toEqual(['P5', 'P7', 'P9']);
    expect(r.newTags).toEqual(['P9']);
  });

  it('returns a fresh array when nothing new is declared', () => {
    const existing = ['P5'];
    const r = mergeDeclaredTags(existing, []);
    expect(r.updatedTags).toEqual(['P5']);
    expect(r.updatedTags).not.toBe(existing);
  });
});

describe('backfillExistingRules', () => {
  it('returns a shallow clone when no new tags need backfilling', () => {
    const rules = [rule({ ruleId: '1', sampleGroupId: grpA, sampleId: sampX, barcodes: { P5: 'AAAA' } })];
    const out = backfillExistingRules(rules, []);
    expect(out).toEqual(rules);
    expect(out).not.toBe(rules);
  });

  it('adds an empty value for each newly declared tag while preserving existing keys', () => {
    const rules = [rule({ ruleId: '1', sampleGroupId: grpA, sampleId: sampX, barcodes: { P5: 'AAAA' } })];
    const out = backfillExistingRules(rules, ['P7']);
    expect(out[0].barcodes).toEqual({ P5: 'AAAA', P7: '' });
  });

  it('does not mutate the caller-supplied rule objects', () => {
    const rules = [rule({ ruleId: '1', sampleGroupId: grpA, sampleId: sampX, barcodes: { P5: 'AAAA' } })];
    backfillExistingRules(rules, ['P7']);
    expect(rules[0].barcodes).toEqual({ P5: 'AAAA' });
  });
});

describe('buildRuleFromRow', () => {
  const mintRuleId = () => 'rule-1';

  it('returns null when no tags are declared', () => {
    const r = buildRuleFromRow({
      row: { barcodes: {} },
      updatedTags: [],
      groupId: grpA,
      sampleId: sampX,
      mintRuleId,
    });
    expect(r).toBeNull();
  });

  it('builds a well-formed rule when the row covers every declared tag', () => {
    const r = buildRuleFromRow({
      row: { barcodes: { P5: 'AAAA', P7: 'GGGG' } },
      updatedTags: ['P5', 'P7'],
      groupId: grpA,
      sampleId: sampX,
      mintRuleId,
    });
    expect(r).toEqual({
      ruleId: 'rule-1',
      sampleGroupId: grpA,
      sampleId: sampX,
      barcodes: { P5: 'AAAA', P7: 'GGGG' },
    });
  });

  it('returns null when a declared tag is missing from the row (the Option B fix)', () => {
    const r = buildRuleFromRow({
      row: { barcodes: { P7: 'GGGG' } },
      updatedTags: ['P5', 'P7'],
      groupId: grpA,
      sampleId: sampX,
      mintRuleId,
    });
    expect(r).toBeNull();
  });

  it('returns null when a declared tag has an empty value in the row', () => {
    const r = buildRuleFromRow({
      row: { barcodes: { P5: '', P7: 'GGGG' } },
      updatedTags: ['P5', 'P7'],
      groupId: grpA,
      sampleId: sampX,
      mintRuleId,
    });
    expect(r).toBeNull();
  });

  it('returns null when the row has no barcodes object at all', () => {
    const r = buildRuleFromRow({
      row: {},
      updatedTags: ['P5'],
      groupId: grpA,
      sampleId: sampX,
      mintRuleId,
    });
    expect(r).toBeNull();
  });
});
