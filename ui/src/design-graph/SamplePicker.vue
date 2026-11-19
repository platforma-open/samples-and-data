<script lang="ts" setup>
import {
  PlBtnGhost,
  PlBtnGroup,
  PlBtnPrimary,
  PlCheckbox,
  PlDropdownMulti,
  PlRadio,
} from "@milaboratories/uikit";
import { computed, shallowRef, useCssModule } from "vue";
import type { SampleFilter } from "./filter";
import { filterOptions, matchesFilters } from "./filter";
import { partOptions } from "./layout";
import type { Part, Sample } from "./types";

const props = defineProps<{
  samples: Sample[];
  placed: Set<string>;
  title: string;
  target?: string;
  mode: "add" | "replace";
  part: Part;
  showConnection: boolean;
}>();
const emit = defineEmits<{ add: [samples: Sample[], part: Part]; close: [] }>();
const styles = useCssModule();

const part = shallowRef(props.part);
const filters = shallowRef<SampleFilter[]>([]);
const selected = shallowRef<Set<string>>(new Set());

const options = computed(() => filterOptions(props.samples));
const shown = computed(() =>
  props.samples.filter((sample) => matchesFilters(sample, filters.value)),
);
const selectable = computed(() => shown.value.filter((sample) => !props.placed.has(sample.id)));
const chosen = computed(() => selectable.value.filter((sample) => selected.value.has(sample.id)));
const allChosen = computed(
  () => selectable.value.length > 0 && chosen.value.length === selectable.value.length,
);

const toggled = (set: Set<string>, item: string) =>
  set.has(item) ? set.difference(new Set([item])) : set.union(new Set([item]));

const submitLabel = computed(() => {
  if (props.mode === "replace") {
    return "Replace";
  }
  return `Add ${chosen.value.length} ${chosen.value.length === 1 ? "sample" : "samples"}`;
});

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
        {{ props.title }}
        <b v-if="props.target !== undefined">{{ props.target }}</b>
      </span>
      <slot />
      <PlBtnGhost icon="close" size="small" title="Close" @click="emit('close')" />
    </header>
    <PlDropdownMulti
      v-model="filters"
      label="Filter"
      :placeholder="filters.length === 0 ? 'All samples' : 'Search'"
      :options="options"
    />
    <div :class="styles.list">
      <PlCheckbox
        v-if="props.mode === 'add'"
        :model-value="allChosen"
        :disabled="selectable.length === 0"
        @update:model-value="toggleAll"
      >
        Select all
      </PlCheckbox>
      <div v-for="sample in shown" :key="sample.id" :class="styles.row">
        <PlCheckbox
          v-if="props.mode === 'add'"
          :model-value="selected.has(sample.id)"
          :disabled="props.placed.has(sample.id)"
          @update:model-value="() => (selected = toggled(selected, sample.id))"
        >
          <span :class="styles.id">{{ sample.id }}</span>
          <span :class="styles.meta">{{ summary(sample) }}</span>
        </PlCheckbox>
        <PlRadio
          v-else
          name="replace-sample"
          :value="sample.id"
          :model-value="chosen[0]?.id"
          :disabled="props.placed.has(sample.id)"
          @update:model-value="() => (selected = new Set([sample.id]))"
        >
          <span :class="styles.id">{{ sample.id }}</span>
          <span :class="styles.meta">{{ summary(sample) }}</span>
        </PlRadio>
        <span v-if="props.placed.has(sample.id)" :class="styles.meta">In the design</span>
      </div>
    </div>
    <PlBtnGroup
      v-if="props.showConnection"
      v-model="part"
      label="Connection"
      :options="partOptions"
    />
    <PlBtnPrimary :disabled="chosen.length === 0" @click="add">{{ submitLabel }}</PlBtnPrimary>
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
  gap: 8px;
}

.title {
  flex: 1;
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
