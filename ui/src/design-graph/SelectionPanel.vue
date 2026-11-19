<script lang="ts" setup>
import { PlBtnGhost, PlBtnGroup, PlCheckbox, PlTextField } from "@milaboratories/uikit";
import { computed, shallowRef, useCssModule, watch } from "vue";
import { logicalEdge } from "./connect";
import {
  addPartition,
  addStep,
  findMaterial,
  insertStep,
  joinSplit,
  leaveSplit,
  setName,
  setPart,
  setStep,
  siblingsOf,
  splitLine,
} from "./edit";
import { junctionOf } from "./junctions";
import { displayName, partOptions } from "./layout";
import { parentsOf } from "./toGraph";
import type { Design, Graph, Material, Part, Selection, Step } from "./types";

const props = defineProps<{
  design: Design;
  graph: Graph;
  selection: NonNullable<Selection>;
}>();
const emit = defineEmits<{
  change: [design: Design, selection?: Selection];
  delete: [];
  replace: [nodeId: string];
  close: [];
}>();
const styles = useCssModule();

const stepOptions: { label: string; value: Step | "one-off" }[] = [
  { label: "One-off", value: "one-off" },
  { label: "Round", value: "round" },
  { label: "Timecourse", value: "timecourse" },
];

const kindOf = (id: string) => props.graph.nodes.find((item) => item.id === id)?.kind;
const labelOf = (id: string) => {
  const graphNode = props.graph.nodes.find((item) => item.id === id);
  if (graphNode === undefined) {
    return "";
  }
  return displayName(graphNode);
};

const edge = computed(() => {
  if (props.selection.kind !== "edge") {
    return undefined;
  }
  return props.graph.edges.find((item) => item.id === props.selection.id);
});
const node = computed(() => {
  if (props.selection.kind !== "node") {
    return undefined;
  }
  return props.graph.nodes.find((item) => item.id === props.selection.id);
});

const child = computed(() => {
  if (edge.value === undefined || kindOf(edge.value.to) !== "material") {
    return undefined;
  }
  return findMaterial(props.design, edge.value.to);
});
const childFrom = computed(() => child.value?.from);
const canDisconnect = computed(
  () =>
    props.selection.kind === "edge" && logicalEdge(props.graph, props.selection.id) !== undefined,
);
const canAddPartition = computed(
  () => child.value !== undefined && splitLine(props.design, child.value.id) !== undefined,
);
const stepValue = computed((): Step | "one-off" => childFrom.value?.step ?? "one-off");
const siblings = computed(() =>
  child.value === undefined ? [] : siblingsOf(props.design, child.value.id),
);

const material = computed(() => {
  if (node.value?.kind !== "material" || !node.value.sequenced) {
    return undefined;
  }
  return findMaterial(props.design, node.value.id);
});

const shadowMaterial = computed(() => {
  if (node.value?.kind !== "material" || node.value.sequenced) {
    return undefined;
  }
  return findMaterial(props.design, node.value.id);
});
const shadowKind = computed(() => {
  if (shadowMaterial.value?.from === undefined) {
    return "Starting material";
  }
  return "Step";
});
const shadowNameDraft = shallowRef("");
watch(shadowMaterial, (current) => (shadowNameDraft.value = current?.name ?? ""), {
  immediate: true,
});

function commitShadowName() {
  const name = shadowNameDraft.value.trim();
  if (shadowMaterial.value === undefined || name === (shadowMaterial.value.name ?? "")) {
    return;
  }
  const id = shadowMaterial.value.id;
  emit("change", name === "" ? setName(props.design, id) : setName(props.design, id, name));
}

function onAddStep(parentId: string) {
  const added = addStep(props.design, parentId);
  emit("change", added.design, { kind: "node", id: added.id });
}

function onInsertStep() {
  if (child.value === undefined) {
    return;
  }
  const inserted = insertStep(props.design, child.value.id);
  if (inserted === undefined) {
    return;
  }
  emit("change", inserted.design, { kind: "node", id: inserted.id });
}

const junction = computed(() => junctionOf(props.graph, node.value?.id));

const pool = computed(() => {
  if (node.value?.kind !== "pool") {
    return undefined;
  }
  const id = node.value.id;
  return {
    parents: props.graph.edges.filter((item) => item.to === id).map((item) => item.from),
    child: props.graph.edges.find((item) => item.from === id)?.to,
  };
});

const pooledInto = computed(() => {
  if (edge.value === undefined || kindOf(edge.value.to) !== "pool") {
    return undefined;
  }
  const poolId = edge.value.to;
  return props.graph.edges.find((item) => item.from === poolId)?.to;
});

function changeOf(target: Material | undefined, next: (design: Design, id: string) => Design) {
  if (target === undefined) {
    return;
  }
  emit("change", next(props.design, target.id));
}

const changeChild = (next: (design: Design, id: string) => Design) => changeOf(child.value, next);

function onSplitLine() {
  if (child.value === undefined) {
    return;
  }
  const result = splitLine(props.design, child.value.id);
  if (result === undefined) {
    return;
  }
  emit("change", result.design, { kind: "node", id: result.id });
}

function onAddPartition() {
  if (junction.value === undefined) {
    return;
  }
  const added = addPartition(props.design, junction.value.parentId, junction.value.split);
  emit("change", added.design, { kind: "node", id: added.id });
}
</script>

<template>
  <section :class="styles.panel">
    <div :class="styles.corner">
      <PlBtnGhost
        v-if="node !== undefined || canDisconnect"
        icon="delete-bin"
        size="small"
        title="Delete"
        @click="emit('delete')"
      />
      <PlBtnGhost icon="close" size="small" title="Close" @click="emit('close')" />
    </div>
    <template v-if="child !== undefined && childFrom !== undefined">
      <header :class="styles.header">
        <span :class="styles.kind">Edge</span>
        <span :class="styles.title">
          {{ parentsOf(childFrom).map(labelOf).join(" + ") }} → {{ labelOf(child.id) }}
        </span>
        <PlBtnGhost icon="add" size="small" @click="onInsertStep">Insert step</PlBtnGhost>
        <PlBtnGhost v-if="canAddPartition" icon="add" size="small" @click="onSplitLine">
          Add partition
        </PlBtnGhost>
      </header>
      <div :class="styles.row">
        <PlBtnGroup
          label="Connection"
          :options="partOptions"
          :model-value="childFrom.part"
          @update:model-value="
            (part: Part) => changeChild((design, id) => setPart(design, id, part))
          "
        />
        <PlBtnGroup
          label="Step type"
          :options="stepOptions"
          :model-value="stepValue"
          @update:model-value="
            (step: Step | 'one-off') =>
              changeChild((design, id) =>
                step === 'one-off' ? setStep(design, id) : setStep(design, id, step),
              )
          "
        />
        <div v-if="childFrom.part === 'slice' && siblings.length > 0" :class="styles.group">
          <div :class="styles.groupLabel">Same split as</div>
          <div :class="styles.checks">
            <PlCheckbox
              v-for="sibling in siblings"
              :key="sibling.id"
              :model-value="
                sibling.from?.part === 'slice' && sibling.from.split === childFrom.split
              "
              @update:model-value="
                (same: boolean) =>
                  changeChild((design, id) =>
                    same ? joinSplit(design, id, sibling.id) : leaveSplit(design, sibling.id),
                  )
              "
            >
              {{ labelOf(sibling.id) }}
            </PlCheckbox>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="pooledInto !== undefined">
      <header :class="styles.header">
        <span :class="styles.kind">Edge</span>
        <span :class="styles.title"
          >{{ labelOf(edge?.from ?? "") }} → {{ labelOf(pooledInto) }}</span
        >
      </header>
      <p :class="styles.note">Merged with the other parents of {{ labelOf(pooledInto) }}.</p>
    </template>

    <template v-else-if="material !== undefined">
      <header :class="styles.header">
        <span :class="styles.kind">Sample</span>
        <span :class="[styles.title, styles.field]">{{ labelOf(material.id) }}</span>
        <PlBtnGhost icon="add" size="small" @click="onAddStep(material.id)">Add step</PlBtnGhost>
        <PlBtnGhost size="small" @click="emit('replace', material.id)">
          Replace with sample
        </PlBtnGhost>
      </header>
      <p v-if="material.issue !== undefined" :class="styles.issue">{{ material.issue }}</p>
      <dl v-else :class="styles.labels">
        <template v-for="(value, key) in material.meta" :key="key">
          <dt>{{ key }}</dt>
          <dd>{{ value }}</dd>
        </template>
      </dl>
    </template>

    <template v-else-if="shadowMaterial !== undefined">
      <header :class="styles.header">
        <span :class="styles.kind">{{ shadowKind }}</span>
        <div :class="styles.field" @focusout="commitShadowName">
          <PlTextField
            v-model="shadowNameDraft"
            label="Name"
            placeholder="Optional"
            @keydown.enter="commitShadowName"
          />
        </div>
        <PlBtnGhost icon="add" size="small" @click="onAddStep(shadowMaterial.id)">
          Add step
        </PlBtnGhost>
        <PlBtnGhost size="small" @click="emit('replace', shadowMaterial.id)">
          Replace with sample
        </PlBtnGhost>
      </header>
    </template>

    <template v-else-if="junction !== undefined">
      <header :class="styles.header">
        <span :class="styles.kind">Split</span>
        <span :class="styles.title">
          {{ labelOf(junction.parentId) }} → {{ junction.partitions.map(labelOf).join(", ") }}
        </span>
        <PlBtnGhost icon="add" size="small" @click="onAddPartition">Add partition</PlBtnGhost>
      </header>
    </template>

    <template v-else-if="pool !== undefined">
      <header :class="styles.header">
        <span :class="styles.kind">Merge</span>
        <span :class="styles.title">
          {{ pool.parents.map(labelOf).join(" + ") }} → {{ labelOf(pool.child ?? "") }}
        </span>
      </header>
      <p :class="styles.note">Added where a sample has several parents.</p>
    </template>
  </section>
</template>

<style module>
.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding-inline-end: 64px;
}

.corner {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  display: flex;
}

.kind {
  color: var(--txt-03);
}

.title {
  flex: 1;
  font-weight: 600;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 24px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.groupLabel {
  font-weight: 600;
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.field {
  flex-basis: 100%;
}

.labels {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 16px;
  margin: 0;

  & dt {
    color: var(--txt-03);
  }

  & dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
}

.issue {
  margin: 0;
  color: var(--txt-error);
}

.note {
  margin: 0;
  color: var(--txt-03);
}
</style>
