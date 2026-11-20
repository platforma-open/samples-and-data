<script lang="ts" setup>
// The design wizard: say what each metadata column did to the material, and watch the draft
// graph rebuild. Follows experimental-design-ui-wizard's demo (approach B): one role per column,
// a fixed set of follow-up fields per role, parents inferred from the labels.
import type { DesignWizardAnswers } from "@platforma-open/milaboratories.samples-and-data.model";
import { columnNames, designLabel } from "@platforma-open/milaboratories.samples-and-data.model";
import {
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  PlBtnPrimary,
  PlBtnSecondary,
  PlCheckbox,
  PlDropdown,
  PlDropdownMulti,
} from "@platforma-sdk/ui-vue";
import { computed, ref, useCssModule } from "vue";
import { useApp } from "../app";
import DesignGraph from "../design-graph/DesignGraph.vue";
import { withJunctions } from "../design-graph/junctions";
import { toGraph } from "../design-graph/toGraph";
import { buildB, ROLE_B_TEXT, ROLES_B } from "../design-wizard/lineage";
import type { ColumnB, ConfigB, RoleB } from "../design-wizard/lineage";
import { suggestB } from "../design-wizard/suggest";
import { naturalOrder } from "../design-wizard/table";
import { designMaterials, wizardTable } from "../design-wizard/toDesign";
import { editorDesign, tableSamples } from "../design_table";

const app = useApp();
const styles = useCssModule();

const designId = computed(() => app.queryParams.id);
const designs = computed(() => app.model.data.designs ?? []);
const index = computed(() => designs.value.findIndex((design) => design.id === designId.value));
const current = computed(() => designs.value[index.value]);
const name = computed(() => (current.value ? designLabel(current.value, index.value) : ""));

const samples = computed(() => tableSamples(app.model.data));
const columns = computed(() => columnNames(app.model.data.metadata));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const suggested = computed(() =>
  suggestB(wizardTable(name.value, columns.value, samples.value, {})),
);
// answers saved in an older shape are dropped: the wizard starts from the suggestion again
const saved = Array.isArray(current.value?.wizard?.columns) ? current.value.wizard : undefined;
// stored as a list: column order matters to the wizard, and stored maps lose key order
const answers = ref<ConfigB>(
  saved
    ? {
        columns: Object.fromEntries(
          saved.columns.map(({ column, answer }) => [column, clone(answer) as ColumnB]),
        ),
      }
    : clone(suggested.value),
);
const orders = ref<Record<string, string[]>>(clone(saved?.orders ?? {}));
const table = computed(() => wizardTable(name.value, columns.value, samples.value, orders.value));

const built = computed(() => {
  try {
    const materials = designMaterials(buildB(table.value, answers.value));
    const graph = withJunctions(toGraph(editorDesign(materials, samples.value)));
    return { materials, graph };
  } catch (error) {
    return { error: (error as Error).message };
  }
});

// ------------------------------------------------------------------ editing answers
const GLYPH: Record<RoleB, string> = {
  label: "·",
  source: "◇",
  copy: "⧉",
  treatment: "⑂",
  condition: "⚙",
  fraction: "◔",
  series: "→",
  generation: "⟳",
};

// "condition" is not its own menu entry: it is a parallel arm that can change between rounds
const roleOptions = ROLES_B.filter((role) => role !== "condition").map((role) => ({
  value: role,
  label: `${GLYPH[role]}  ${ROLE_B_TEXT[role][0]}`,
}));

const columnOf = (column: string): ColumnB => answers.value.columns[column] ?? { role: "label" };
const menuRole = (column: string) =>
  columnOf(column).role === "condition" ? "treatment" : columnOf(column).role;

/** Sets a column's answer, keeping its place in the listing (which breaks ties: outer first). */
function setColumn(column: string, next: ColumnB | null) {
  const entries = Object.entries(answers.value.columns);
  const at = entries.findIndex(([key]) => key === column);
  if (next === null || next.role === "label") {
    answers.value = { columns: Object.fromEntries(entries.filter(([key]) => key !== column)) };
  } else if (at >= 0) {
    entries[at] = [column, next];
    answers.value = { columns: Object.fromEntries(entries) };
  } else {
    answers.value = { columns: Object.fromEntries([...entries, [column, next]]) };
  }
}
const patch = (column: string, change: Partial<ColumnB>) =>
  setColumn(column, { ...columnOf(column), ...change });

function setRole(column: string, role: RoleB) {
  const baseline = columnOf(column).baseline;
  setColumn(column, { role, ...(baseline && { baseline }) });
}

const values = (column: string) => [
  ...new Set(
    table.value.rows.map((row) => row.meta[column]).filter((value) => value !== undefined),
  ),
];
const hasBlanks = (column: string) =>
  table.value.rows.some((row) => row.meta[column] === undefined);
const valueOptions = (column: string) => values(column).map((value) => ({ value, label: value }));

/** One question for rounds and time points; each answer sets step type, kept, and line together. */
const SERIES_KINDS: {
  value: string;
  label: string;
  set: Pick<ColumnB, "step" | "part" | "spine">;
}[] = [
  {
    value: "round",
    label: "Selection round: a selected part went on",
    set: { step: "round", part: "slice", spine: false },
  },
  {
    value: "grown",
    label: "Only part goes on over time (screen days, passages, crossing a barrier)",
    set: { step: "timecourse", part: "slice", spine: false },
  },
  {
    value: "collected",
    label: "Sampled again from the same subject or vessel, which kept going",
    set: { step: "timecourse", part: "whole", spine: true },
  },
  {
    value: "once",
    label: "Only two states: before and after one treatment",
    set: { step: "none", part: "slice", spine: false },
  },
];
function seriesKind(column: string) {
  const answer = columnOf(column);
  const step = answer.step ?? "round";
  const part = answer.part ?? "slice";
  const spine = !!answer.spine;
  return (
    SERIES_KINDS.find(
      (kind) => kind.set.step === step && kind.set.part === part && !!kind.set.spine === spine,
    )?.value ?? "other"
  );
}
const seriesOptions = (column: string) => [
  ...SERIES_KINDS.map(({ value, label }) => ({ value, label })),
  ...(seriesKind(column) === "other" ? [{ value: "other", label: "(another combination)" }] : []),
];
const setSeriesKind = (column: string, value: string) => {
  const kind = SERIES_KINDS.find((item) => item.value === value);
  if (kind) patch(column, kind.set);
};

/** Roles whose listing order decides nesting within one step: earlier is outer. */
const NESTS: readonly RoleB[] = ["copy", "fraction", "treatment", "condition"];
const nesting = computed(() =>
  Object.keys(answers.value.columns).filter((key) =>
    NESTS.includes(answers.value.columns[key]!.role),
  ),
);
const outerOf = (column: string) => nesting.value[nesting.value.indexOf(column) - 1] ?? "";
/** Puts `column` right after `outer` ("done within each outer"), or first when `outer` is empty. */
function nestInside(column: string, outer: string) {
  const keys = Object.keys(answers.value.columns).filter((key) => key !== column);
  const first = keys.findIndex((key) => NESTS.includes(answers.value.columns[key]!.role));
  const at = outer ? keys.indexOf(outer) + 1 : first < 0 ? keys.length : first;
  keys.splice(at, 0, column);
  answers.value = {
    columns: Object.fromEntries(keys.map((key) => [key, answers.value.columns[key]!])),
  };
}

// rounds and generations in order; the user moves values into place. Input values are left out,
// as the wizard reads them as "before this step".
const orderOf = (column: string) =>
  naturalOrder(
    values(column).filter((value) => !columnOf(column).baseline?.includes(value)),
    orders.value[column],
  );
/**
 * Sets the input values. A value taken out of them comes first in the order, as it was before
 * every step; the others keep theirs. Otherwise a value with no number (`Uns`) drops the whole
 * order back to row order.
 */
function setBaseline(column: string, baseline: string[]) {
  const freed = (columnOf(column).baseline ?? []).filter((value) => !baseline.includes(value));
  if (freed.length > 0)
    orders.value = { ...orders.value, [column]: [...freed, ...orderOf(column)] };
  patch(column, { baseline: baseline.length ? baseline : undefined });
}
function move(column: string, from: number, to: number) {
  const order = orderOf(column);
  if (to < 0 || to >= order.length) return;
  order.splice(to, 0, order.splice(from, 1)[0]!);
  orders.value = { ...orders.value, [column]: order };
}

/** JSON with sorted keys, so answers compare equal whatever order their fields were set in. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, inner: unknown) =>
    inner !== null && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : inner,
  );
const isSuggested = (column: string) =>
  canonical(answers.value.columns[column] ?? null) ===
  canonical(suggested.value.columns[column] ?? null);

// ------------------------------------------------------------------ actions
function reset() {
  answers.value = clone(suggested.value);
  orders.value = {};
}

async function createDraft() {
  if ("error" in built.value) return;
  const materials = built.value.materials;
  const wizard: DesignWizardAnswers = {
    columns: Object.entries(clone(answers.value.columns)).map(([column, answer]) => ({
      column,
      answer: answer as DesignWizardAnswers["columns"][number]["answer"],
    })),
    orders: clone(orders.value),
  };
  await app.updateData((data) => ({
    ...data,
    designs: (data.designs ?? []).map((design) =>
      design.id === designId.value ? { ...design, materials, wizard } : design,
    ),
  }));
  await app.navigateTo(`/design?id=${designId.value}`);
}

const noop = () => {};
const noDrop = () => false;
const noneMarked = new Set<string>();
</script>

<template>
  <PlBlockPage>
    <template #title>Draft from metadata</template>
    <template v-if="current !== undefined" #append>
      <PlBtnGhost @click="reset">Reset to suggestion</PlBtnGhost>
      <PlBtnSecondary @click="app.navigateTo(`/design?id=${designId}`)">Cancel</PlBtnSecondary>
      <PlBtnPrimary :disabled="'error' in built" @click="createDraft">Create draft</PlBtnPrimary>
    </template>
    <PlAlert v-if="current === undefined" type="error">This design no longer exists.</PlAlert>
    <PlAlert v-else-if="columns.length === 0" type="warn">
      The metadata table has no columns. Add metadata on the main page first; the wizard builds the
      graph from it.
    </PlAlert>
    <div v-else :class="styles.layout">
      <section :class="styles.columns">
        <p v-if="current.materials.length > 0" :class="styles.intro">
          Creating the draft replaces the current graph of {{ name }}.
        </p>
        <article
          v-for="column in columns"
          :key="column"
          :class="[styles.card, columnOf(column).role === 'label' && styles.quiet]"
        >
          <header :class="styles.head">
            <span :class="styles.glyph">{{ GLYPH[columnOf(column).role] }}</span>
            <span :class="styles.name">{{ column }}</span>
            <span :class="isSuggested(column) ? styles.suggested : styles.changed">
              {{ isSuggested(column) ? "suggested" : "changed" }}
            </span>
          </header>
          <PlDropdown
            :model-value="menuRole(column)"
            :options="roleOptions"
            label="Role"
            @update:model-value="(role) => role && setRole(column, role as RoleB)"
          />
          <p :class="styles.desc">{{ ROLE_B_TEXT[columnOf(column).role][1] }}</p>

          <div
            v-if="columnOf(column).role === 'series' || columnOf(column).role === 'generation'"
            :class="styles.values"
          >
            <span :class="styles.note">Order:</span>
            <span v-for="(value, at) in orderOf(column)" :key="value" :class="styles.chip">
              <button :class="styles.arrow" title="Earlier" @click="move(column, at, at - 1)">
                ‹
              </button>
              {{ value }}
              <button :class="styles.arrow" title="Later" @click="move(column, at, at + 1)">
                ›
              </button>
            </span>
          </div>
          <div v-else :class="styles.values">
            <span v-for="value in values(column).slice(0, 8)" :key="value" :class="styles.chip">
              {{ value }}
            </span>
            <span v-if="values(column).length > 8" :class="styles.chip">
              +{{ values(column).length - 8 }}
            </span>
          </div>

          <template
            v-if="
              columnOf(column).role !== 'label' &&
              (columnOf(column).role !== 'source' || columnOf(column).baseline?.length)
            "
          >
            <PlDropdownMulti
              :model-value="[...(columnOf(column).baseline ?? [])]"
              :options="valueOptions(column)"
              label="Input (before this step)"
              placeholder="None"
              @update:model-value="(baseline: string[]) => setBaseline(column, baseline)"
            />
            <PlDropdown
              v-if="columnOf(column).baseline?.length"
              :model-value="columnOf(column).baselineIs ?? 'parent'"
              :options="[
                { value: 'parent', label: 'Sequenced directly; later samples came from it' },
                { value: 'aliquot', label: 'A separate unselected control, sequenced alongside' },
              ]"
              label="The input sample is"
              @update:model-value="
                (value) => patch(column, { baselineIs: value as 'parent' | 'aliquot' })
              "
            />
          </template>
          <PlCheckbox
            v-if="columnOf(column).role === 'treatment' || columnOf(column).role === 'condition'"
            :model-value="columnOf(column).role === 'condition'"
            @update:model-value="
              (ramp: boolean) => patch(column, { role: ramp ? 'condition' : 'treatment' })
            "
          >
            Values follow one another along one arm (a ramp), not side by side
          </PlCheckbox>
          <PlDropdown
            v-if="
              ['copy', 'treatment', 'condition', 'fraction'].includes(columnOf(column).role) &&
              (hasBlanks(column) || columnOf(column).blankIs)
            "
            :model-value="columnOf(column).blankIs ?? 'before'"
            :options="[
              { value: 'before', label: 'Step not done (yet, or at all)' },
              { value: 'own', label: 'A group of their own' },
            ]"
            label="Empty cells mean"
            @update:model-value="(value) => patch(column, { blankIs: value as 'before' | 'own' })"
          />
          <PlDropdown
            v-if="columnOf(column).role === 'series'"
            :model-value="seriesKind(column)"
            :options="seriesOptions(column)"
            label="Each value vs the one before"
            @update:model-value="(kind) => setSeriesKind(column, kind ?? '')"
          />
          <PlDropdown
            v-if="columnOf(column).role === 'fraction'"
            :model-value="columnOf(column).carry ?? 'each'"
            :options="[
              { value: 'each', label: 'Each gate on its own (or none went on)' },
              ...valueOptions(column),
            ]"
            label="Taken into the next round"
            @update:model-value="
              (carry) => patch(column, { carry: !carry || carry === 'each' ? undefined : carry })
            "
          />
          <template v-if="columnOf(column).role === 'generation'">
            <PlDropdown
              :model-value="columnOf(column).libraryBy?.[0] ?? ''"
              :options="[
                { value: '', label: 'None' },
                ...columns
                  .filter((other) => other !== column)
                  .map((other) => ({ value: other, label: other })),
              ]"
              label="One new library per value of"
              @update:model-value="(by) => patch(column, { libraryBy: by ? [by] : undefined })"
            />
            <PlDropdown
              :model-value="columnOf(column).remadeFrom ?? 'virtual'"
              :options="[
                { value: 'virtual', label: 'Hits from an unsequenced final output' },
                { value: 'last', label: 'Hits from the last sequenced samples' },
              ]"
              label="New library designed from"
              @update:model-value="
                (value) => patch(column, { remadeFrom: value as 'last' | 'virtual' })
              "
            />
          </template>
          <PlDropdown
            v-if="
              (columnOf(column).role === 'copy' || columnOf(column).role === 'fraction') &&
              nesting.length > 1
            "
            :model-value="outerOf(column)"
            :options="[
              { value: '', label: 'Nothing: split before the others' },
              ...nesting
                .filter((other) => other !== column)
                .map((other) => ({ value: other, label: other })),
            ]"
            label="Split separately for each value of"
            @update:model-value="(outer) => nestInside(column, outer ?? '')"
          />
        </article>
      </section>

      <section :class="styles.preview">
        <PlAlert v-if="'error' in built" type="error">
          These answers do not make a graph: {{ built.error }}
        </PlAlert>
        <template v-else>
          <div :class="styles.canvas">
            <DesignGraph
              :graph="built.graph"
              :selection="null"
              :can-drop="noDrop"
              :covered-right="0"
              :marked="noneMarked"
              @select="noop"
            />
          </div>
        </template>
      </section>
    </div>
  </PlBlockPage>
</template>

<style module>
.layout {
  display: grid;
  grid-template-columns: minmax(360px, 440px) 1fr;
  gap: 16px;
  block-size: 100%;
  min-block-size: 0;
}

.columns {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-inline-end: 4px;
}

.intro,
.desc,
.note {
  margin: 0;
  color: var(--txt-03);
  font-size: 13px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px;
  border: 1px solid var(--border-color-div-grey);
  border-radius: 6px;
}

.quiet {
  opacity: 0.75;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.glyph {
  inline-size: 16px;
  text-align: center;
}

.name {
  flex: 1;
  font-weight: 600;
}

.suggested,
.changed {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
}

.suggested {
  color: var(--txt-03);
  border: 1px solid var(--border-color-div-grey);
}

.changed {
  color: var(--txt-01);
  background: var(--bg-elevated-02, #eef);
}

.values {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--bg-base-light, #f2f3f5);
  font-size: 12px;
}

.arrow {
  border: none;
  background: none;
  cursor: pointer;
  padding: 0 2px;
  color: var(--txt-03);
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-block-size: 0;
}

.canvas {
  position: relative;
  flex: 1;
  overflow: hidden;
  min-block-size: 320px;
  border: 1px solid var(--border-color-div-grey);
  border-radius: 6px;
  background: radial-gradient(var(--border-color-div-grey) 1px, transparent 1px) 0 0 / 16px 16px;
}
</style>
