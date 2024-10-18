<script setup lang="ts">
import { isDefined, ListOption, PlBtnPrimary, PlBtnSecondary, PlCheckbox, PlDialogModal, PlDropdown } from '@platforma-sdk/ui-vue';
import { useApp } from './app';
import { ImportResult } from './dataimport';
import { computed, reactive, watch } from 'vue';
import { MetadataColumn, uniquePlId } from '@platforma-open/milaboratories.samples-and-data.model';
import { ar } from 'vitest/dist/chunks/reporters.C4ZHgdxQ.js';
import { determineBestMatchingAlgorithm } from './sample_matching';

const props = defineProps<{ importCandidate: ImportResult }>()

const emit = defineEmits<{ onClose: [] }>();

const app = useApp();

const data = reactive({
    sampleNameColumnIdx: -1,
    addUnmatchedSamples: false
});

watch(() => props.importCandidate, (ic) => {
    data.sampleNameColumnIdx = ic.data.columns.findIndex(c => c.header.includes("sample"));
    if (data.sampleNameColumnIdx === -1)
        data.sampleNameColumnIdx = 0;
}, { immediate: true })

const algo = computed(() => determineBestMatchingAlgorithm(Object.values(
    app.model.args.sampleLabels).filter(isDefined),
    data.sampleNameColumnIdx === -1
        ? []
        : props.importCandidate.data.rows.map(r => r[data.sampleNameColumnIdx]).filter(isDefined).map(v => String(v))))

const sampleColumnOptions = computed<ListOption<number>[]>(() => props.importCandidate.data.columns.map((c, idx) => ({ value: idx, label: c.header })))

function columnNamesMatch(existingColumn: string, importColumn: string): boolean {
    return existingColumn.toLocaleLowerCase().trim() === importColumn.toLocaleLowerCase().trim();
}

const colsMatchingExisting = computed(() => {
    let res = 0;
    for (const c of props.importCandidate.data.columns)
        if (app.model.args.metadata.find(mc => columnNamesMatch(mc.label, c.header))) res++;
    return res;
})

const tableDataText = computed(() => {
    const ic = props.importCandidate;
    let result = ""
    result += `  Columns: ${ic.data.columns.length} (match existing ${colsMatchingExisting.value})\n`
    result += `  Rows: ${ic.data.rows.length}\n`
    result += `  Matching algorithm: ${algo.value.topAlgorithm.name}\n`
    result += `  Matching: ${algo.value.matches}`
    return result;
})

const tableIssuesText = computed(() => {
    const ic = props.importCandidate;
    if (ic.emptyColumns > 0 || ic.emptyRowsRemoved > 0 || ic.missingHeaders > 0) {
        let result = ``
        if (ic.emptyColumns > 0)
            result += `  Empty columns removed: ${ic.emptyColumns}\n`
        if (ic.emptyRowsRemoved > 0)
            result += `  Empty rows removed: ${ic.emptyRowsRemoved}\n`
        if (ic.missingHeaders > 0)
            result += `  Missing headers: ${ic.missingHeaders}\n`
        return result;
    }
    return undefined;
})

function runImport() {
    const args = app.model.args;

    // undefined for sample name column
    const modelColumns: (MetadataColumn | undefined)[] = []

    // Detecting already existing metadata columns or adding new once
    for (let cIdx = 0; cIdx < props.importCandidate.data.columns.length; ++cIdx) {
        if (cIdx === data.sampleNameColumnIdx)
            modelColumns.push(undefined);
        else {
            const column = props.importCandidate.data.columns[cIdx]
            const existing = app.model.args.metadata.find(mc => columnNamesMatch(mc.label, column.header));
            if (existing)
                modelColumns.push(existing);
            else {
                const mColumn: MetadataColumn = {
                    id: uniquePlId(),
                    valueType: column.type,
                    label: column.header,
                    global: true,
                    data: {}
                };
                args.metadata.push(mColumn);
                modelColumns.push(mColumn);
            }
        }
    }

    // Adding data
    // for (const row of props.importCandidate.data.rows) {
    //     const sampleIdx = 
    //     for (let cIdx = 0; cIdx < props.importCandidate.data.columns.length; ++cIdx) {

    //     }
    // }

    emit('onClose')
}

</script>

<template>
    <PlDialogModal :model-value="true" closable @update:model-value="(v) => { if (!v) emit('onClose') }">
        <h3>Import metadata</h3>
        <PlDropdown label="Sample name column" :options="sampleColumnOptions" v-model="data.sampleNameColumnIdx" />
        <PlCheckbox v-model="data.addUnmatchedSamples">
            Add unmatched samples
        </PlCheckbox>
        <div>
            Table to be imported:
            <pre>{{ tableDataText }}</pre>
            <div v-if="tableIssuesText">
                Table issues:
                <pre>{{ tableIssuesText }}</pre>
            </div>
        </div>
        <div :style="{ marginTop: '10px' }" class="d-flex gap-4">
            <PlBtnPrimary>Import</PlBtnPrimary>
            <PlBtnSecondary @click="() => emit('onClose')">Cancel</PlBtnSecondary>
        </div>
    </PlDialogModal>
</template>
