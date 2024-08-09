<script setup lang="ts">

// const app = useApp();

// const data = reactive({
//   modalOpen: false,
//   storageHandle: undefined as StorageHandle | undefined,
//   lsPath: '/Users/gramkin/Code' as string | undefined,
//   storageList: [] as StorageEntry[],
//   files: [] as LsEntry[],
//   lsError: undefined as unknown
// });

// const fileHandle = createModel({
//   get() {
//     return app.args.fileHandle;
//   },
//   validate: z.string().optional().parse,
//   autoSave: true,
//   onSave(v) {
//     console.log('save v', v);
//     app.updateArgs(args => args.fileHandle = v);
//   }
// });

// const fileOptions = computed(() => data.files.filter(it => it.type === 'file').map(it => ({
//   text: it.fullPath,
//   value: it.handle
// })));

// const file = computed(() => app.getOutputFieldOkOptional('file'));

// const progress = computed(() => app.getOutputFieldOkOptional('progress'));

// const loadFiles = debounce((handle: StorageHandle, lsPath: string) => {
//   platforma.lsDriver.listFiles(handle, lsPath).then(result => {
//     data.files = result.entries;
//   }).catch(err => {
//     console.log('error', err);
//     data.lsError = err;
//   });
// }, 1000);

// watch(() => [data.storageHandle, data.lsPath] as const, ([s, p]) => {
//   data.files = [];
//   data.lsError = undefined;
//   if (s && p) {
//     console.log('call load', s, p);
//     loadFiles(s, p)
//   }
// });

// const onImport = (v: ImportedFiles) => {
//   if (v.files.length) {
//     fileHandle.modelValue = v.files[0];
//   }
// };

// onMounted(() => {
//   platforma.lsDriver.getStorageList().then(lst => {
//     data.storageList = lst ?? [];
//   });
// });
</script>

<template>
  <div class="container">
    <h3>Import file</h3>

    <!--
    <select-input label="Storage" v-model="data.storageHandle"
      :options="data.storageList.map(it => ({ text: it.name, value: it.handle }))" />

    <text-field v-if="data.storageHandle" label="LS Path" v-model="data.lsPath" />

    <select-input label="File to upload" v-model="fileHandle.modelValue" :options="fileOptions" clearable />

    <fieldset>
      <legend>File content</legend>
      <pre>{{ file }}</pre>
    </fieldset>

    <fieldset>
      <legend>Progress</legend>
      {{ progress }}
    </fieldset>

    <btn-primary @click="data.modalOpen = true">Or open file dialog</btn-primary>

    <div v-if="data.lsError" class="alert-error">
      Error: {{ data.lsError }}
    </div>
    <fieldset v-else>
      <legend>{{ data.lsPath }}</legend>
      <pre style="overflow: auto; max-height: 300px; max-width: 100%;">{{ data.files }}</pre>
    </fieldset>

    <file-dialog v-model="data.modalOpen" @import:files="onImport" /> -->
  </div>
</template>

<style lang="css">
.alert-error {
  background-color: red;
  color: #fff;
  padding: 12px;
}

.container {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  gap: 24px;
}

fieldset {
  max-height: 300px;
  max-width: 100%;
  overflow: auto;
}

fieldset pre {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  max-width: 600px;
}
</style>