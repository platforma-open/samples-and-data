<script lang="ts" setup>
import {
  PlBtnGroup,
  PlBtnPrimary,
  PlCheckbox,
  PlChip,
  PlDropdown,
  PlDropdownMulti,
  PlRadio,
  PlTooltip,
} from "@milaboratories/uikit";
import { computed, shallowRef, useCssModule } from "vue";
import type { SampleFilter } from "./filter";
import { filterOptions, matchesFilters } from "./filter";
import { partOptions } from "./layout";
import type { Part, Sample } from "./types";

const props = defineProps<{
  samples: Sample[];
  placed: Set<string>;
  mode: "add" | "replace";
  part: Part;
  showConnection: boolean;
}>();
const emit = defineEmits<{ add: [samples: Sample[], part: Part] }>();
const styles = useCssModule();

const MAX_SHOWN_COLUMNS = 2;

const part = shallowRef(props.part);
const filters = shallowRef<SampleFilter[]>([]);
const column = shallowRef<string>();
const shownColumns = shallowRef<string[]>([]);
const selected = shallowRef<Set<string>>(new Set());

const cellsByColumn = computed(() =>
  Map.groupBy(filterOptions(props.samples), (option) => option.value.column),
);
const columnOptions = computed(() =>
  cellsByColumn.value
    .keys()
    .map((name) => ({ label: name, value: name }))
    .toArray(),
);
const cellOptions = computed(() =>
  (cellsByColumn.value.get(column.value ?? "") ?? []).map((option) => ({
    label: option.value.cell,
    value: option.value.cell,
  })),
);
const columnCells = computed(() =>
  filters.value.filter((filter) => filter.column === column.value).map((filter) => filter.cell),
);
const chips = computed(() =>
  Map.groupBy(filters.value, (filter) => filter.column)
    .entries()
    .filter(([name]) => name !== column.value)
    .map(([name, group]) => ({ column: name, cells: group.map((filter) => filter.cell) }))
    .toArray(),
);

const shown = computed(() =>
  props.samples.filter((sample) => matchesFilters(sample, filters.value)),
);
const selectable = computed(() => shown.value.filter((sample) => !props.placed.has(sample.id)));
const chosen = computed(() => selectable.value.filter((sample) => selected.value.has(sample.id)));
const allChosen = computed(
  () => selectable.value.length > 0 && chosen.value.length === selectable.value.length,
);

const submitLabel = computed(() => {
  if (props.mode === "replace") {
    return "Replace";
  }
  return `Add ${chosen.value.length} ${chosen.value.length === 1 ? "sample" : "samples"}`;
});

const toggled = (set: Set<string>, item: string) =>
  set.has(item) ? set.difference(new Set([item])) : set.union(new Set([item]));

function choiceProps(id: string) {
  if (props.mode === "add") {
    return { modelValue: selected.value.has(id) };
  }
  return { name: "replace-sample", value: id, modelValue: chosen.value[0]?.id };
}

function choose(id: string) {
  selected.value = props.mode === "add" ? toggled(selected.value, id) : new Set([id]);
}

function setColumnCells(cells: string[]) {
  const name = column.value;
  if (name === undefined) {
    return;
  }
  filters.value = [
    ...filters.value.filter((filter) => filter.column !== name),
    ...cells.map((cell) => ({ column: name, cell })),
  ];
}

function removeColumn(name: string) {
  filters.value = filters.value.filter((filter) => filter.column !== name);
}

function toggleAll() {
  const ids = new Set(selectable.value.map((sample) => sample.id));
  selected.value = allChosen.value ? selected.value.difference(ids) : selected.value.union(ids);
}

function add() {
  emit("add", chosen.value, part.value);
  selected.value = new Set();
}

const tags = (sample: Sample) =>
  shownColumns.value
    .map((name) => ({ column: name, value: sample.meta[name] }))
    .filter((tag) => tag.value !== undefined);
</script>

<template>
  <section :class="styles.picker">
    <div :class="styles.filters">
      <PlDropdown
        v-model="column"
        label="Filter"
        placeholder="Pick a column"
        :options="columnOptions"
      />
      <PlDropdownMulti
        :model-value="columnCells"
        label="Values"
        placeholder="Any value"
        :options="cellOptions"
        :disabled="column === undefined"
        @update:model-value="setColumnCells"
      />
      <div v-if="chips.length > 0" :class="styles.chips">
        <PlChip
          v-for="chip in chips"
          :key="chip.column"
          small
          closeable
          @click="column = chip.column"
          @close="removeColumn(chip.column)"
        >
          {{ chip.column }}: {{ chip.cells.join(", ") }}
        </PlChip>
      </div>
      <PlDropdownMulti
        :model-value="shownColumns"
        label="Show in list"
        placeholder="None"
        :options="columnOptions"
        @update:model-value="(names: string[]) => (shownColumns = names.slice(-MAX_SHOWN_COLUMNS))"
      />
    </div>
    <PlCheckbox
      v-if="props.mode === 'add'"
      :model-value="allChosen"
      :disabled="selectable.length === 0"
      @update:model-value="toggleAll"
    >
      Select all
    </PlCheckbox>
    <div :class="styles.list">
      <div v-for="sample in shown" :key="sample.id" :class="styles.row">
        <component
          :is="props.mode === 'add' ? PlCheckbox : PlRadio"
          :class="styles.choice"
          v-bind="choiceProps(sample.id)"
          :disabled="props.placed.has(sample.id)"
          @update:model-value="() => choose(sample.id)"
        >
          <PlTooltip :class="styles.name" element="span" position="left">
            {{ sample.name }}
            <template #tooltip>
              <b>{{ sample.name }}</b>
              <div v-for="(value, key) in sample.meta" :key="key">{{ key }}: {{ value }}</div>
            </template>
          </PlTooltip>
        </component>
        <span v-for="tag in tags(sample)" :key="tag.column" :class="styles.tag">
          {{ tag.value }}
        </span>
        <span v-if="props.placed.has(sample.id)" :class="styles.tag">In the design</span>
      </div>
    </div>
    <PlBtnGroup
      v-if="props.showConnection"
      v-model="part"
      label="Connection"
      :options="partOptions"
    />
    <div :class="styles.footer">
      <PlBtnPrimary :disabled="chosen.length === 0" @click="add">{{ submitLabel }}</PlBtnPrimary>
      <slot />
    </div>
  </section>
</template>

<style module>
.picker {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-block-size: 0;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-block-size: 0;
  overflow: auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.choice {
  flex: 1;
  min-inline-size: 0;

  & :global(label),
  & :global(span) {
    min-inline-size: 0;
  }
}

.name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--txt-03);
}

.footer {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
