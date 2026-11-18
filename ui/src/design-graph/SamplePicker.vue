<script lang="ts" setup>
import {
  PlBtnGhost,
  PlBtnGroup,
  PlBtnPrimary,
  PlCheckbox,
  PlDropdown,
  PlDropdownMulti,
} from "@milaboratories/uikit";
import { computed, shallowRef, useCssModule, watch } from "vue";
import type { PortSide } from "./connect";
import type { Part, Sample } from "./types";

const props = defineProps<{
  samples: Sample[];
  placed: Set<string>;
  target: string;
  side: PortSide;
  part: Part;
  showConnection: boolean;
}>();
const emit = defineEmits<{ add: [samples: Sample[], part: Part]; close: [] }>();
const styles = useCssModule();

const partOptions: { label: string; value: Part }[] = [
  { label: "Whole", value: "whole" },
  { label: "Slice", value: "slice" },
  { label: "Remade", value: "remade" },
];

const part = shallowRef(props.part);
const column = shallowRef("");
const values = shallowRef<string[]>([]);
const selected = shallowRef<Set<string>>(new Set());

const columns = computed(() =>
  Array.from(new Set(props.samples.flatMap((sample) => Object.keys(sample.meta)))),
);
const columnOptions = computed(() => [
  { label: "All samples", value: "" },
  ...columns.value.map((name) => ({ label: name, value: name })),
]);
const valueOptions = computed(() =>
  Array.from(
    new Set(
      props.samples
        .map((sample) => sample.meta[column.value])
        .filter((value) => value !== undefined)
        .map(String),
    ),
    (value) => ({ label: value, value }),
  ),
);
watch(column, () => (values.value = []));

const shown = computed(() =>
  props.samples.filter(
    (sample) =>
      column.value === "" ||
      values.value.length === 0 ||
      values.value.includes(String(sample.meta[column.value])),
  ),
);
const selectable = computed(() => shown.value.filter((sample) => !props.placed.has(sample.id)));
const chosen = computed(() => selectable.value.filter((sample) => selected.value.has(sample.id)));
const allChosen = computed(
  () => selectable.value.length > 0 && chosen.value.length === selectable.value.length,
);

const toggled = (set: Set<string>, item: string) =>
  set.has(item) ? set.difference(new Set([item])) : set.union(new Set([item]));

function toggleAll() {
  const ids = new Set(selectable.value.map((sample) => sample.id));
  selected.value = allChosen.value ? selected.value.difference(ids) : selected.value.union(ids);
}

function add() {
  emit("add", chosen.value, part.value);
  selected.value = new Set();
}

const summary = (sample: Sample) =>
  Object.entries(sample.meta)
    .map(([key, value]) => `${key} ${value}`)
    .join(" · ");
</script>

<template>
  <section :class="styles.picker">
    <header :class="styles.header">
      <span :class="styles.title">
        {{ props.side === "out" ? "Add children to" : "Add parents to" }}
        <b>{{ props.target }}</b>
      </span>
      <PlBtnGhost icon="close" size="small" title="Close" @click="emit('close')" />
    </header>
    <PlDropdown v-model="column" label="Filter by" :options="columnOptions" />
    <PlDropdownMulti
      v-model="values"
      label="Values"
      placeholder="Any value"
      :options="valueOptions"
      :disabled="column === ''"
    />
    <div :class="styles.list">
      <PlCheckbox
        :model-value="allChosen"
        :disabled="selectable.length === 0"
        @update:model-value="toggleAll"
      >
        Select all
      </PlCheckbox>
      <div v-for="sample in shown" :key="sample.id" :class="styles.row">
        <PlCheckbox
          :model-value="selected.has(sample.id)"
          :disabled="props.placed.has(sample.id)"
          @update:model-value="() => (selected = toggled(selected, sample.id))"
        >
          <span :class="styles.id">{{ sample.id }}</span>
          <span :class="styles.meta">{{ summary(sample) }}</span>
        </PlCheckbox>
        <span v-if="props.placed.has(sample.id)" :class="styles.meta">In the design</span>
      </div>
    </div>
    <PlBtnGroup
      v-if="props.showConnection"
      v-model="part"
      label="Connection"
      :options="partOptions"
    />
    <PlBtnPrimary :disabled="chosen.length === 0" @click="add">
      Add {{ chosen.length }} {{ chosen.length === 1 ? "sample" : "samples" }}
    </PlBtnPrimary>
  </section>
</template>

<style module>
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title b {
  font-family: var(--font-family-monospace);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-block-size: 320px;
  overflow: auto;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.id {
  font-family: var(--font-family-monospace);
}

.meta {
  margin-inline-start: 8px;
  font-size: 12px;
  color: var(--txt-03);
}
</style>
