<script lang="ts" setup>
import type { ExperimentDesign } from "@platforma-open/milaboratories.samples-and-data.model";
import {
  deriveDesign,
  designPlaceholder,
  designTensorRows,
  type TensorRow,
} from "@platforma-open/milaboratories.samples-and-data.model";
import {
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  PlBtnPrimary,
  PlBtnSecondary,
  PlDialogModal,
  PlEditableTitle,
  PlLoaderCircular,
} from "@platforma-sdk/ui-vue";
import { computed, onBeforeUnmount, onMounted, reactive, shallowRef, useCssModule } from "vue";
import { useApp } from "../app";
import { comparisonSections } from "./comparisons";
import DesignEditor from "../design-graph/DesignEditor.vue";
import DesignWizardPage from "./DesignWizardPage.vue";
import { withJunctions } from "../design-graph/junctions";
import { toGraph } from "../design-graph/toGraph";
import type { Design } from "../design-graph/types";
import { designSamples, editorDesign, storedMaterials, tableSamples } from "../design_table";
import { countOf } from "../string_utils";
import DesignDatasets from "./DesignDatasets.vue";

const app = useApp();
const styles = useCssModule();
const designId = computed(() => app.queryParams.id);
/** The wizard is a mode of this page (`&wizard=1`), so it keeps the design's address. */
// The query type only knows the hrefs the sidebar declares, so the flag is read untyped.
const wizardOpen = computed(
  () => (app.queryParams as Record<string, string | undefined>).wizard === "1",
);
const deleteOpen = shallowRef(false);
const deleting = shallowRef(false);

const designs = computed(() => app.model.data.designs ?? []);
const index = computed(() => designs.value.findIndex((design) => design.id === designId.value));
const current = computed(() => designs.value[index.value]);
/** Samples the design's datasets hold: the ones offered for new nodes. */
const samples = computed(() => designSamples(app.model.data, current.value));

/** The design's tensors and labels (tensor_derivation STEP 2 and 3), as Samples & Data exports them. */
const tensors = computed(() => {
  if (current.value === undefined || current.value.materials.length === 0) return undefined;
  try {
    const derived = deriveDesign(current.value, index.value, app.model.data);
    // Partitions and recurrences are still derived and exported; downstream blocks cannot compare
    // along them, so the list leaves them out.
    const rows = designTensorRows(derived, app.model.data.sampleLabels).filter(
      (row) => row.type === "trajectory" || row.type === "panel",
    );
    const counts = [
      countOf(derived.tensors.trajectories.length, "trajectory"),
      countOf(derived.tensors.panels.length, "panel"),
    ].join(", ");
    return { counts, rows };
  } catch (error) {
    return { error: (error as Error).message };
  }
});
const sections = computed(() => comparisonSections(tensors.value?.rows ?? []));

/** The one collapsed line: where a trajectory runs from and to, or how wide a panel is. */
function summary(row: TensorRow): string {
  const count = row.groups.length;
  if (row.type !== "trajectory") return countOf(count, "arm");
  const ends = [row.groups[0]?.name, row.groups[count - 1]?.name].filter(Boolean).join(" → ");
  return count > 2 ? `${ends} (${count} positions)` : ends;
}

/** Every comparison is one line; its values appear when the line is opened. */
const openSections = reactive(new Set<string>());
const toggleSection = (key: string) => {
  const opening = !openSections.delete(key);
  if (opening) openSections.add(key);
  activeRow.value = opening ? key : undefined;
};
/** The comparison (or collapsed section) clicked in the list; its part of the graph is lit. */
const activeRow = shallowRef<string>();
const highlight = computed(() => {
  const section = sections.value.find((item) => item.key === activeRow.value);
  const rows = section?.rows ?? tensors.value?.rows?.filter((item) => item.id === activeRow.value);
  return rows?.length ? new Set(rows.flatMap((row) => row.members)) : undefined;
});
/** Esc, or a click anywhere but a comparison row, clears the highlight. */
const clearOnEsc = (event: KeyboardEvent) => {
  if (event.key === "Escape") activeRow.value = undefined;
};
onMounted(() => window.addEventListener("keydown", clearOnEsc));
onBeforeUnmount(() => window.removeEventListener("keydown", clearOnEsc));
const clearOnClickAway = (event: PointerEvent) => {
  if (!(event.target as Element).closest("[data-comparison]")) activeRow.value = undefined;
};
const panel = shallowRef<HTMLElement>();
const panelHeight = shallowRef<number>();
/** Dragging the bar above the comparisons trades height with the graph. */
function startResize(event: PointerEvent) {
  const el = panel.value;
  if (el === undefined) return;
  const handle = event.currentTarget as HTMLElement;
  const startY = event.clientY;
  const start = el.offsetHeight;
  const max = (el.parentElement?.clientHeight ?? 600) - 160;
  handle.setPointerCapture(event.pointerId);
  const move = (e: PointerEvent) =>
    (panelHeight.value = Math.min(max, Math.max(120, start + startY - e.clientY)));
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", () => handle.removeEventListener("pointermove", move), {
    once: true,
  });
}
const drawable = computed(() => {
  try {
    const design = editorDesign(
      current.value?.materials ?? [],
      tableSamples(app.model.data),
      new Set(samples.value.map((sample) => sample.id)),
    );
    withJunctions(toGraph(design));
    return { design };
  } catch {
    return undefined;
  }
});

const updateCurrent = (change: (design: ExperimentDesign) => ExperimentDesign) =>
  app.updateData((data) => ({
    ...data,
    designs: (data.designs ?? []).map((design) =>
      design.id === designId.value ? change(design) : design,
    ),
  }));

const save = (next: Design) =>
  void updateCurrent((design) => ({ ...design, materials: storedMaterials(next) }));
const rename = (label: string) => void updateCurrent((design) => ({ ...design, label }));
const clear = () => void updateCurrent((design) => ({ ...design, materials: [] }));

async function deleteDesign() {
  deleteOpen.value = false;
  deleting.value = true;
  await app.updateData((data) => ({
    ...data,
    designs: (data.designs ?? []).filter((design) => design.id !== designId.value),
  }));
  await app.allSettled();
  await app.navigateTo("/");
}
</script>

<template>
  <DesignWizardPage v-if="wizardOpen" />
  <template v-else>
    <PlBlockPage>
      <template #title>
        <PlEditableTitle
          v-if="current !== undefined"
          :model-value="current.label"
          :placeholder="designPlaceholder(index)"
          max-width="600px"
          :max-length="40"
          @update:model-value="rename"
        />
      </template>
      <template v-if="current !== undefined" #append>
        <PlBtnGhost icon="add" @click="app.navigateTo(`/design?id=${designId}&wizard=1`)">
          Draft from metadata
        </PlBtnGhost>
        <PlBtnGhost icon="delete-bin" @click="deleteOpen = true">Delete design</PlBtnGhost>
      </template>
      <PlLoaderCircular v-if="deleting" />
      <PlAlert v-else-if="current === undefined" type="error"
        >This design no longer exists.</PlAlert
      >
      <PlAlert v-else-if="drawable === undefined" type="error">
        The saved design cannot be drawn.
        <PlBtnSecondary size="small" @click="clear">Clear design</PlBtnSecondary>
      </PlAlert>
      <div v-else :class="styles.body" @pointerdown.capture="clearOnClickAway">
        <DesignDatasets />
        <PlAlert v-if="current.materials.length === 0" type="info">
          Start from the metadata table: say what each column did to the material, and the wizard
          drafts the graph.
          <PlBtnSecondary size="small" @click="app.navigateTo(`/design?id=${designId}&wizard=1`)">
            Draft from metadata
          </PlBtnSecondary>
        </PlAlert>
        <div :class="styles.editor">
          <DesignEditor
            :design="drawable.design"
            :samples="samples"
            :highlight="highlight"
            @change="save"
          />
        </div>
        <div
          v-if="tensors !== undefined"
          :class="styles.splitter"
          title="Drag to resize"
          @pointerdown="startResize"
        />
        <section
          v-if="tensors !== undefined"
          ref="panel"
          :class="styles.tensors"
          :style="panelHeight ? { blockSize: `${panelHeight}px`, maxBlockSize: 'none' } : undefined"
        >
          <header :class="styles.tensorsHead">
            Comparisons
            <span v-if="'counts' in tensors" :class="styles.note">{{ tensors.counts }}</span>
          </header>
          <PlAlert v-if="'error' in tensors" type="warn">
            No comparisons: {{ tensors.error }}
          </PlAlert>
          <ol v-else :class="styles.list">
            <template v-for="section in sections" :key="section.key">
              <li
                :class="[styles.row, section.key === activeRow && styles.active]"
                data-comparison
                :title="openSections.has(section.key) ? 'Hide the values' : 'Show the values'"
                @click="toggleSection(section.key)"
              >
                <span :class="styles.kind">
                  {{ openSections.has(section.key) ? "▾" : "▸" }}
                  {{
                    section.rows.length > 1
                      ? countOf(section.rows.length, section.rows[0].type)
                      : section.rows[0].id.replace("-", " ")
                  }}
                </span>
                <span :class="styles.note">{{ section.rows[0].by || "no axis" }}</span>
                <span :class="styles.summary">{{ summary(section.rows[0]) }}</span>
                <span :class="styles.note">
                  {{
                    [
                      ...(section.factors.length ? ["one per " + section.factors.join(" · ")] : []),
                      ...section.shared,
                    ].join(", ")
                  }}
                </span>
              </li>
              <template v-if="openSections.has(section.key)">
                <li
                  v-for="row in section.rows"
                  :key="row.id"
                  :class="[styles.row, styles.child, row.id === activeRow && styles.active]"
                  data-comparison
                  title="Show in the graph"
                  @click="activeRow = row.id === activeRow ? undefined : row.id"
                >
                  <span :class="styles.kind">{{ row.id.replace("-", " ") }}</span>
                  <span :class="styles.note">{{ row.factorValues }}</span>
                  <span :class="styles.groups">
                    <template v-for="(group, k) in row.groups" :key="k">
                      <span v-if="k > 0 && row.type === 'trajectory'" :class="styles.note">→</span>
                      <span :class="styles.chip" :title="group.samples.join(', ')">{{
                        group.name
                      }}</span>
                    </template>
                  </span>
                </li>
              </template>
            </template>
          </ol>
        </section>
      </div>
    </PlBlockPage>

    <PlDialogModal v-model="deleteOpen">
      <template #title>Delete this design?</template>
      <template #actions>
        <PlBtnPrimary @click="deleteDesign">Delete</PlBtnPrimary>
        <PlBtnSecondary @click="deleteOpen = false">Cancel</PlBtnSecondary>
      </template>
    </PlDialogModal>
  </template>
</template>

<style module>
.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  block-size: 100%;
}

.editor {
  flex: 1;
  min-block-size: 0;
}

.tensors {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-block-size: 35%;
  min-block-size: 120px;
}

.splitter {
  flex: none;
  block-size: 8px;
  margin-block: -8px;
  cursor: row-resize;
  border-radius: 4px;
}

.splitter:hover {
  background: var(--border-color-div-grey);
}

.tensorsHead {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-weight: 600;
}

.note {
  font-weight: 400;
  color: var(--txt-03);
  font-size: 13px;
}

.list {
  flex: 1;
  margin: 0;
  padding: 4px 0;
  overflow: auto;
  list-style: none;
  border: 1px solid var(--border-color-div-grey);
  border-radius: 6px;
}

.row {
  display: grid;
  grid-template-columns: 110px minmax(80px, 160px) 1fr minmax(0, 30%);
  gap: 12px;
  align-items: center;
  padding: 4px 12px;
}

/* a collapsed comparison stays on one line however long its labels are */
.row > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary {
  font-size: 13px;
}

.row {
  cursor: pointer;
}

.row:hover {
  background: var(--bg-base-light, #f2f3f5);
}

.row.child {
  padding-inline-start: 32px;
  font-size: 13px;
}

.row.active {
  background: var(--border-color-focus-shadow);
}

.row + .row {
  border-block-start: 1px solid var(--border-color-div-grey);
}

.kind {
  font-size: 13px;
  font-weight: 500;
  text-transform: capitalize;
}

/* the opened values are the one place labels may wrap */
.groups {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  overflow: visible;
  white-space: normal;
}

.chip {
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--bg-base-light, #f2f3f5);
  font-size: 12px;
  white-space: nowrap;
}
</style>
