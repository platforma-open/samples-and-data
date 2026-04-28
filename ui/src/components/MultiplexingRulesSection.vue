<script setup lang="ts">
import type { BarcodeRule, DSMultiplexedFastq, PlId } from '@platforma-open/milaboratories.samples-and-data.model';
import {
  PlAlert,
  PlBtnGhost,
  PlBtnSecondary,
  PlDropdown,
  PlTextField,
} from '@platforma-sdk/ui-vue';
import type { ListOption } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';
import { getOrCreateSample } from '../dialogs/datasets';

const props = defineProps<{
  dataset: DSMultiplexedFastq;
}>();

const app = useApp();

const TAG_NAME_RX = /^[A-Za-z0-9]+$/;
const NUCLEOTIDE_RX = /^[ACGTNacgtn]+$/;

// `dataset.content` is reactive (BlockModelV3 deep watcher) — but per
// monorepo convention, replace whole arrays / records on mutation so the
// watcher reliably detects the change.
const tags = computed(() => props.dataset.content.barcodeTags);
const rules = computed(() => props.dataset.content.barcodeRules);

const groupOptions = computed<ListOption<PlId>[]>(() =>
  Object.keys(props.dataset.content.data).map((groupId) => ({
    value: groupId as PlId,
    label: props.dataset.content.groupLabels[groupId as PlId] ?? groupId,
  })),
);

const sampleOptions = computed<ListOption<PlId | ''>[]>(() => [
  { value: '' as const, label: '— Select sample —' },
  ...Object.entries(app.model.data.sampleLabels).map(([id, label]) => ({
    value: id as PlId,
    label,
  })),
]);

function setTags(next: string[]) {
  props.dataset.content.barcodeTags = next;
}

function setRules(next: BarcodeRule[]) {
  props.dataset.content.barcodeRules = next;
}

function tagError(name: string, idx: number): string | undefined {
  if (!name) return 'Tag name is required';
  if (!TAG_NAME_RX.test(name)) return 'Use letters and digits only';
  if (tags.value.some((t, i) => i !== idx && t === name)) return 'Tag name must be unique';
  return undefined;
}

function freshTagName(): string {
  const used = new Set(tags.value);
  let i = tags.value.length + 1;
  while (used.has(`Tag${i}`)) i++;
  return `Tag${i}`;
}

function addTag() {
  const newTag = freshTagName();
  setTags([...tags.value, newTag]);
  setRules(rules.value.map((r) => ({
    ...r,
    barcodes: { ...r.barcodes, [newTag]: '' },
  })));
}

function renameTag(idx: number, newName: string) {
  const oldName = tags.value[idx];
  if (oldName === newName) return;
  const next = [...tags.value];
  next[idx] = newName;
  setTags(next);
  if (tagError(newName, idx) !== undefined) return;
  setRules(rules.value.map((r) => {
    const { [oldName]: value, ...rest } = r.barcodes;
    return { ...r, barcodes: { ...rest, [newName]: value ?? '' } };
  }));
}

function removeTag(idx: number) {
  const oldName = tags.value[idx];
  setTags(tags.value.filter((_, i) => i !== idx));
  setRules(rules.value.map((r) => {
    const { [oldName]: _drop, ...rest } = r.barcodes;
    return { ...r, barcodes: rest };
  }));
}

function addRule() {
  const last = rules.value[rules.value.length - 1];
  const groupIds = Object.keys(props.dataset.content.data) as PlId[];
  const sampleGroupId = (last?.sampleGroupId ?? groupIds[0] ?? '') as PlId;
  const sampleId = (last?.sampleId ?? '') as PlId;
  const barcodes: Record<string, string> = {};
  for (const t of tags.value) barcodes[t] = '';
  setRules([...rules.value, { sampleGroupId, sampleId, barcodes }]);
}

function removeRule(idx: number) {
  setRules(rules.value.filter((_, i) => i !== idx));
}

function updateRuleField<K extends keyof BarcodeRule>(idx: number, key: K, value: BarcodeRule[K]) {
  const next = rules.value.map((r, i) => (i === idx ? { ...r, [key]: value } : r));
  setRules(next);
}

function updateRuleBarcode(idx: number, tag: string, value: string) {
  const next = rules.value.map((r, i) =>
    i === idx ? { ...r, barcodes: { ...r.barcodes, [tag]: value } } : r,
  );
  setRules(next);
}

function pickSample(idx: number, sampleId: PlId | '') {
  if (sampleId === '') return;
  updateRuleField(idx, 'sampleId', sampleId);
}

// Resolve a free-form sample label entered by the operator into a block-level
// PlId — reuses an existing sampleId when the label matches, otherwise mints
// a new one. Mirrors the samplesheet-import path.
function resolveSampleByLabel(idx: number, label: string) {
  if (!label) return;
  const id = getOrCreateSample(app, label);
  updateRuleField(idx, 'sampleId', id);
}

function barcodeError(value: string): string | undefined {
  if (!value) return 'Required';
  return undefined;
}

function barcodeWarning(value: string): string | undefined {
  if (value && !NUCLEOTIDE_RX.test(value)) return 'Non-nucleotide characters';
  return undefined;
}
</script>

<template>
  <div class="multiplexing-rules">
    <div class="multiplexing-rules__header">
      <h3>Multiplexing Rules</h3>
      <span class="multiplexing-rules__hint">
        Declare the barcode tag names used in this dataset, then add one rule
        row per (group, sample, barcode) combination. Multiple rows for the
        same sample mean alternatives.
      </span>
    </div>

    <!-- Tag declaration -->
    <div class="tag-row">
      <span class="tag-row__label">Tags:</span>
      <div v-if="tags.length === 0" class="tag-row__placeholder">
        Declare at least one tag to begin (e.g. <code>P5</code>, <code>P7</code>, <code>BarcodeID</code>).
      </div>
      <div
        v-for="(tagName, tagIdx) in tags"
        :key="tagIdx"
        class="tag-chip"
        :class="{ 'tag-chip--error': tagError(tagName, tagIdx) !== undefined }"
      >
        <input
          class="tag-chip__input"
          :value="tagName"
          :title="tagError(tagName, tagIdx) ?? 'Tag name'"
          @change="(e) => renameTag(tagIdx, (e.target as HTMLInputElement).value)"
        />
        <PlBtnGhost
          class="tag-chip__remove"
          icon="close"
          @click="removeTag(tagIdx)"
        />
      </div>
      <PlBtnGhost icon="add" @click="addTag">Add tag</PlBtnGhost>
    </div>

    <!-- Rules table -->
    <div v-if="tags.length === 0" class="rules-empty">
      <PlAlert type="warn">
        Add a tag above before declaring multiplexing rules.
      </PlAlert>
    </div>

    <table v-else class="rules-table">
      <thead>
        <tr>
          <th class="rules-table__hcol">Sample Group</th>
          <th class="rules-table__hcol">Sample</th>
          <th
            v-for="t in tags"
            :key="t"
            class="rules-table__hcol"
          >
            {{ t }}
          </th>
          <th class="rules-table__hcol rules-table__actions" />
        </tr>
      </thead>
      <tbody>
        <tr v-if="rules.length === 0">
          <td :colspan="tags.length + 3" class="rules-table__empty">
            No rules yet. Click "Add rule" to fill in the first one.
          </td>
        </tr>
        <tr v-for="(rule, ruleIdx) in rules" :key="ruleIdx">
          <td class="rules-table__cell">
            <PlDropdown
              :model-value="rule.sampleGroupId"
              :options="groupOptions"
              @update:model-value="(v) => updateRuleField(ruleIdx, 'sampleGroupId', v as PlId)"
            />
          </td>
          <td class="rules-table__cell">
            <PlDropdown
              :model-value="rule.sampleId || ''"
              :options="sampleOptions"
              @update:model-value="(v) => pickSample(ruleIdx, v as PlId)"
            />
          </td>
          <td
            v-for="t in tags"
            :key="t"
            class="rules-table__cell"
            :class="{
              'rules-table__cell--error': barcodeError(rule.barcodes[t] ?? '') !== undefined,
              'rules-table__cell--warn': barcodeError(rule.barcodes[t] ?? '') === undefined
                && barcodeWarning(rule.barcodes[t] ?? '') !== undefined,
            }"
          >
            <PlTextField
              :model-value="rule.barcodes[t] ?? ''"
              placeholder="Enter barcode"
              :title="barcodeError(rule.barcodes[t] ?? '') ?? barcodeWarning(rule.barcodes[t] ?? '') ?? ''"
              @update:model-value="(v: string) => updateRuleBarcode(ruleIdx, t, v)"
            />
          </td>
          <td class="rules-table__actions">
            <PlBtnGhost icon="close" @click="removeRule(ruleIdx)" />
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="tags.length > 0" class="rules-table__footer">
      <PlBtnSecondary @click="addRule">+ Add rule</PlBtnSecondary>
    </div>
  </div>
</template>

<style scoped>
.multiplexing-rules {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border-color, #d0d0d0);
  border-radius: 6px;
  background-color: var(--bg-elevated, #fafafa);
}

.multiplexing-rules__header h3 {
  margin: 0 0 4px 0;
}

.multiplexing-rules__hint {
  font-size: 12px;
  color: var(--text-secondary, #6a6a6a);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.tag-row__label {
  font-weight: 600;
}

.tag-row__placeholder {
  font-style: italic;
  color: var(--text-tertiary, #9a9a9a);
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 4px 2px 8px;
  border: 1px solid var(--border-color, #c0c0c0);
  border-radius: 12px;
  background-color: var(--bg-base, #ffffff);
  gap: 4px;
}

.tag-chip--error {
  border-color: var(--error-color, #e25c5c);
}

.tag-chip__input {
  border: none;
  outline: none;
  background: transparent;
  width: 80px;
  font-size: 13px;
}

.tag-chip__remove {
  cursor: pointer;
}

.rules-empty {
  padding: 8px 0;
}

.rules-table {
  width: 100%;
  border-collapse: collapse;
  background-color: var(--bg-base, #ffffff);
  border-radius: 4px;
}

.rules-table__hcol {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-color, #d0d0d0);
  font-weight: 600;
  font-size: 13px;
}

.rules-table__cell {
  padding: 4px 8px;
  vertical-align: middle;
  border-bottom: 1px solid var(--border-color-soft, #ececec);
}

.rules-table__cell--error {
  background-color: var(--error-bg, #fff0f0);
}

.rules-table__cell--warn {
  background-color: var(--warn-bg, #fff7e6);
}

.rules-table__actions {
  width: 40px;
  text-align: right;
}

.rules-table__empty {
  text-align: center;
  padding: 24px;
  color: var(--text-tertiary, #9a9a9a);
  font-style: italic;
}

.rules-table__footer {
  margin-top: 4px;
}
</style>
