<script lang="ts" setup>
import { PlBlockPage, PlBtnGroup } from "@platforma-sdk/ui-vue";
import { computed, shallowRef, useCssModule } from "vue";
import DesignEditor from "../design-graph/DesignEditor.vue";
import { designFixtures } from "../design-graph/fixtures";

const styles = useCssModule();
const fixtureId = shallowRef(designFixtures[0].id);
const fixture = computed(() => designFixtures.find((item) => item.id === fixtureId.value)!);
const options = designFixtures.map((item) => ({ label: item.name, value: item.id }));
</script>

<template>
  <PlBlockPage>
    <template #title>Design</template>
    <template #append>
      <PlBtnGroup v-model="fixtureId" :options="options" compact />
    </template>
    <div :class="styles.body">
      <DesignEditor :key="fixture.id" :initial="fixture.design" />
    </div>
  </PlBlockPage>
</template>

<style module>
.body {
  block-size: 100%;
}
</style>
