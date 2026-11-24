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
  PlDialogModal,
  PlDropdown,
  PlDropdownMulti,
  PlElementList,
} from "@platforma-sdk/ui-vue";
import { computed, ref, useCssModule, watch } from "vue";
import { useApp } from "../app";
import DesignGraph from "../design-graph/DesignGraph.vue";
import { withJunctions } from "../design-graph/junctions";
import { toGraph } from "../design-graph/toGraph";
import { buildB, ROLE_B_TEXT, ROLES_B } from "../design-wizard/lineage";
import type { ColumnB, ConfigB, RoleB } from "../design-wizard/lineage";
import { suggestB } from "../design-wizard/suggest";
import { naturalOrder } from "../design-wizard/table";
import { designMaterials, wizardTable } from "../design-wizard/toDesign";
import { designSamples, editorDesign } from "../design_table";
import DesignDatasets from "./DesignDatasets.vue";

const app = useApp();
const styles = useCssModule();

const designId = computed(() => app.queryParams.id);
const designs = computed(() => app.model.data.designs ?? []);
const index = computed(() => designs.value.findIndex((design) => design.id === designId.value));
const current = computed(() => designs.value[index.value]);
const name = computed(() => (current.value ? designLabel(current.value, index.value) : ""));

const samples = computed(() => designSamples(app.model.data, current.value));
/** Columns with a value for at least one sample the design applies to; the others are not offered. */
const columns = computed(() =>
  columnNames(app.model.data.metadata).filter((column) =>
    samples.value.some((sample) => String(sample.meta[column] ?? "").trim() !== ""),
  ),
);
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
// answers for columns no longer offered (the design's datasets changed) are dropped
watch(
  columns,
  (offered) => {
    const kept = Object.entries(answers.value.columns).filter(([column]) =>
      offered.includes(column),
    );
    if (kept.length < Object.keys(answers.value.columns).length)
      answers.value = { columns: Object.fromEntries(kept) };
  },
  { immediate: true },
);
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

// Columns that shape the lineage come first; info-only ones sit in a group of their own at the
// end, so scanning the top of the list only passes answers that matter.
const info = computed(() => columns.value.filter((column) => columnOf(column).role === "label"));
const lineage = computed(() => columns.value.filter((column) => columnOf(column).role !== "label"));
const keyOf = (column: string) => column;
// the list renders an item's content only while it reads as expanded, and these never collapse
const alwaysOpen = () => true;
const helpOpen = ref(false);
/**
 * Which roles ask what the material was before the step. Replicates and library generations do
 * not: a replicate is never the material its peers were made from, and a generation value is
 * always a library that was built, so the answer can only invent a line that was not run. No
 * study in the corpus carries such a value on either.
 */
const hasBaseline = (column: string) => {
  const { role, baseline } = columnOf(column);
  if (role === "label" || role === "copy" || role === "generation") return false;
  return role !== "source" || !!baseline?.length;
};
/** Whether a role brings follow-up questions: with none, the card shows no divider under its role. */
const hasDetails = (column: string) => {
  const role = columnOf(column).role;
  if (role === "copy") return false;
  if (role === "generation") return false;
  return hasBaseline(column) || (role !== "label" && role !== "source");
};

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
  // the roles that never ask for one do not carry a hidden answer over from another role
  const baseline = role === "copy" || role === "generation" ? undefined : columnOf(column).baseline;
  setColumn(column, { role, ...(baseline && { baseline }) });
}

const values = (column: string) => [
  ...new Set(
    table.value.rows.map((row) => row.meta[column]).filter((value) => value !== undefined),
  ),
];
const valueOptions = (column: string) => values(column).map((value) => ({ value, label: value }));

/**
 * One question for rounds and time points: did a selected part go on, or was the same material
 * sampled again. Whether the step reads as a round or a time point is taken from the suggestion,
 * since on every series column in the corpus it labels the edge without changing a tensor.
 */
const SERIES_KINDS: { value: string; label: string; set: Pick<ColumnB, "part" | "spine"> }[] = [
  {
    value: "selected",
    label: "A selected part went on (a selection round, a screen day, a passage, a barrier)",
    set: { part: "slice", spine: false },
  },
  {
    value: "collected",
    label: "Sampled again from the same subject or vessel, which kept going",
    set: { part: "whole", spine: true },
  },
];
const seriesKind = (column: string) => {
  const answer = columnOf(column);
  return answer.part === "whole" && answer.spine ? "collected" : "selected";
};
const seriesOptions = () => SERIES_KINDS.map(({ value, label }) => ({ value, label }));
const setSeriesKind = (column: string, value: string) => {
  const kind = SERIES_KINDS.find((item) => item.value === value);
  if (!kind) return;
  // the suggestion reads a day or a week as a time course and everything else as a round
  const step = value === "collected" ? "timecourse" : suggested.value.columns[column]?.step;
  patch(column, { ...kind.set, step: step ?? "round" });
};

/** Roles whose listing order decides nesting within one step: earlier is outer. */
const NESTS: readonly RoleB[] = ["copy", "fraction", "treatment", "condition"];
const nesting = computed(() =>
  Object.keys(answers.value.columns).filter((key) =>
    NESTS.includes(answers.value.columns[key]!.role),
  ),
);
/** Puts the splits in a new order, keeping every other column where it is. */
function setNesting(order: string[]) {
  let next = 0;
  const keys = Object.keys(answers.value.columns).map((key) =>
    NESTS.includes(answers.value.columns[key]!.role) ? order[next++]! : key,
  );
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
function setOrder(column: string, order: string[]) {
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
      <PlBtnGhost round icon="help-outline" title="What the roles mean" @click="helpOpen = true" />
      <PlBtnGhost @click="reset">Reset to suggestion</PlBtnGhost>
      <PlBtnSecondary @click="app.navigateTo(`/design?id=${designId}`)">Cancel</PlBtnSecondary>
      <PlBtnPrimary :disabled="'error' in built" @click="createDraft">Create design</PlBtnPrimary>
    </template>
    <DesignDatasets />
    <PlAlert v-if="current === undefined" type="error">This design no longer exists.</PlAlert>
    <PlAlert v-else-if="columns.length === 0" type="warn">
      No metadata column has a value for this design's samples. Add metadata on the main page, or
      pick other datasets; the wizard builds the graph from it.
    </PlAlert>
    <div v-else :class="styles.layout">
      <section :class="styles.columns">
        <p v-if="current.materials.length > 0" :class="styles.intro">
          Creating the design replaces the current graph of {{ name }}.
        </p>
        <template v-if="nesting.length > 1">
          <h3 :class="styles.group">Split order, outer first</h3>
          <PlElementList
            :items="nesting"
            :get-item-key="keyOf"
            disable-removing
            disable-expanding
            disable-toggling
            disable-pinning
            @update:items="setNesting"
          >
            <template #item-title="{ item: column }">
              <span :class="styles.glyph">{{ GLYPH[menuRole(column)] }}</span>
              <span :class="styles.name">{{ column }}</span>
            </template>
          </PlElementList>
          <h3 :class="styles.group">Columns</h3>
        </template>
        <PlElementList
          :items="lineage"
          :get-item-key="keyOf"
          :is-expanded="alwaysOpen"
          disable-dragging
          disable-removing
          disable-expanding
          disable-toggling
          disable-pinning
        >
          <template #item-title="{ item: column }">
            <span :class="styles.glyph">{{ GLYPH[menuRole(column)] }}</span>
            <span :class="styles.name">{{ column }}</span>
            <span v-if="!isSuggested(column)" :class="styles.changed">changed</span>
          </template>
          <template #item-content="{ item: column }">
            <PlDropdown
              :model-value="menuRole(column)"
              :options="roleOptions"
              label="Role"
              @update:model-value="(role) => role && setRole(column, role as RoleB)"
            />

            <div
              v-if="columnOf(column).role === 'series' || columnOf(column).role === 'generation'"
              :class="styles.order"
            >
              <span :class="styles.note">Order, earliest first</span>
              <PlElementList
                :items="orderOf(column)"
                :get-item-key="keyOf"
                disable-removing
                disable-expanding
                disable-toggling
                disable-pinning
                @update:items="(order: string[]) => setOrder(column, order)"
              >
                <template #item-title="{ item: value }">
                  <span :class="styles.name">{{ value }}</span>
                </template>
              </PlElementList>
            </div>
            <div v-else :class="styles.values">
              <span v-for="value in values(column).slice(0, 8)" :key="value" :class="styles.chip">
                {{ value }}
              </span>
              <span v-if="values(column).length > 8" :class="styles.chip">
                +{{ values(column).length - 8 }}
              </span>
            </div>

            <div v-if="hasDetails(column)" :class="styles.details">
              <PlDropdownMulti
                v-if="hasBaseline(column)"
                :model-value="[...(columnOf(column).baseline ?? [])]"
                :options="valueOptions(column)"
                label="Input / baseline"
                placeholder="None"
                @update:model-value="(baseline: string[]) => setBaseline(column, baseline)"
              />
              <PlCheckbox
                v-if="
                  columnOf(column).role === 'treatment' || columnOf(column).role === 'condition'
                "
                :model-value="columnOf(column).role === 'condition'"
                @update:model-value="
                  (ramp: boolean) => patch(column, { role: ramp ? 'condition' : 'treatment' })
                "
              >
                Values follow one another along one arm (a ramp), not side by side
              </PlCheckbox>
              <PlDropdown
                v-if="columnOf(column).role === 'series'"
                :model-value="seriesKind(column)"
                :options="seriesOptions()"
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
                  (carry) =>
                    patch(column, { carry: !carry || carry === 'each' ? undefined : carry })
                "
              />
            </div>
          </template>
        </PlElementList>

        <h3 v-if="info.length > 0" :class="styles.group">Not used to build the graph</h3>
        <PlElementList
          v-if="info.length > 0"
          :items="info"
          :get-item-key="keyOf"
          :is-expanded="alwaysOpen"
          :item-class="styles.quiet"
          disable-dragging
          disable-removing
          disable-expanding
          disable-toggling
          disable-pinning
        >
          <template #item-title="{ item: column }">
            <span :class="styles.glyph">{{ GLYPH.label }}</span>
            <span :class="styles.name">{{ column }}</span>
          </template>
          <template #item-content="{ item: column }">
            <PlDropdown
              :model-value="menuRole(column)"
              :options="roleOptions"
              label="Role"
              @update:model-value="(role) => role && setRole(column, role as RoleB)"
            />
            <div :class="styles.values">
              <span v-for="value in values(column).slice(0, 8)" :key="value" :class="styles.chip">
                {{ value }}
              </span>
              <span v-if="values(column).length > 8" :class="styles.chip">
                +{{ values(column).length - 8 }}
              </span>
            </div>
          </template>
        </PlElementList>
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
    <PlDialogModal v-model="helpOpen" closable width="560px">
      <template #title>What the roles mean</template>
      <p :class="styles.desc">
        Each column says what its values did to the material. The draft graph rebuilds as you
        answer, so a wrong role shows up as a wrong graph.
      </p>
      <dl :class="styles.help">
        <template v-for="role in ROLES_B" :key="role">
          <dt :class="styles.helpName">
            <span :class="styles.glyph">{{ GLYPH[role] }}</span
            >{{ ROLE_B_TEXT[role][0] }}
          </dt>
          <dd :class="styles.desc">{{ ROLE_B_TEXT[role][1] }}</dd>
        </template>
      </dl>
      <p :class="styles.desc">
        <b>Input / baseline</b> marks the values that mean the step had not happened yet: the input
        library, the unsorted population, round 0, day 0. Those samples are read as the material the
        others were made from, not as a step, an arm or a gate of their own.
      </p>
    </PlDialogModal>
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
  gap: 20px;
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

/* A group heading, so info-only columns read as one block and not as more answers to give. */
.group {
  margin: 8px 0 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--txt-03);
}

/* The split strip is the one card not in an element list, so it carries that list's surface. */
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 16px;
  background: #fffc;
  border: 1px solid var(--color-div-grey, var(--border-color-div-grey));
  border-radius: 6px;
}

/* Columns outside the lineage carry no answer, so they sit back on the page instead of on it, and
   nothing here answers to a click, so the list's highlight is off at rest and on hover alike. The
   class is tripled to outrank the list's own .root.opened rule whatever order the sheets load in. */
.quiet.quiet.quiet {
  --background: var(--bg-base-light, #f7f8fa);
  --head-background: unset;
  --border-color: var(--color-div-grey, var(--border-color-div-grey));
}

.quiet .name {
  font-weight: 500;
  color: var(--txt-03);
}

.order {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-block-size: 24px;
}

.glyph {
  inline-size: 16px;
  text-align: center;
  color: var(--txt-03);
}

.name {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
}

/* The follow-up questions a role brings: one block, held apart from the column's own line. */
.details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-block-start: 16px;
  border-block-start: 1px solid var(--border-color-div-grey);
}

.help {
  display: grid;
  gap: 4px 0;
  margin: 16px 0;
}

.helpName {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.helpName:not(:first-child) {
  margin-block-start: 12px;
}

.help dd {
  margin: 0;
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
