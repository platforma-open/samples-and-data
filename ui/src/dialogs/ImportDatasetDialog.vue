<script setup lang="ts">
import type {
  DSContentBulkCountMatrix,
  DSContentCellRangerMtx,
  DSContentFasta,
  DSContentFastq,
  DSContentH5,
  DSContentH5ad,
  DSContentMultilaneFastq,
  DSContentMultiplexedFastq,
  DSContentMultiSampleH5ad,
  DSContentMultiSampleSeurat,
  DSContentMultiSampleXsv,
  DSContentSeurat,
  DSContentTaggedAb1,
  DSContentTaggedFastq,
  DSContentTaggedXsv,
  DSContentXsv,
  DSType,
  PlId,
  ReadIndices,
} from "@platforma-open/milaboratories.samples-and-data.model";
import type { ImportFileHandle } from "@platforma-sdk/model";
import { getFileNameFromHandle, getFilePathFromHandle, uniquePlId } from "@platforma-sdk/model";
import type { ListOption } from "@platforma-sdk/ui-vue";
import {
  PlAlert,
  PlBtnGhost,
  PlBtnGroup,
  PlBtnPrimary,
  PlBtnSecondary,
  PlCheckbox,
  PlDialogModal,
  PlDropdown,
  PlFileDialog,
  PlRow,
  PlTextField,
  ReactiveFileContent,
} from "@platforma-sdk/ui-vue";
import * as _ from "radashi";
import { computed, reactive, ref, watch } from "vue";
import { useApp } from "../app";
import type { ImportMode } from "./datasets";
import {
  datasetTypes,
  extractFileName,
  getOrCreateSample,
  modesOptions,
  useParsedFiles,
  usePatternCompilation,
} from "./datasets";
import type { FileContentType, FileNamePattern } from "./file_name_parser";
import {
  collectReadIndices,
  getWellFormattedReadIndex,
  inferFileNamePattern,
  normalizeCellRangerFileRole,
} from "./file_name_parser";
import ParsedFilesList from "./ParsedFilesList.vue";

type ImportDatasetDialogData = {
  /**
   * Import mode: create new dataset or add to existing dataset
   */
  mode: ImportMode;
  /**
   * Target dataset to add to if create new dataset is selected
   */
  targetAddDataset: PlId | undefined;
  /**
   * Type of the dataset to create; undefined means not yet inferred from the files or set by the user
   */
  datasetType: DSType | undefined;
  /**
   * Type of the files in the dataset
   */
  fileType: FileContentType | undefined;
  /**
   * Whether the dataset has tags
   */
  hasTags: boolean;
  /**
   * Whether the files are gzipped
   */
  gzipped: boolean;
  /**
   * Read indices that present in the files
   */
  readIndices: string[];
  /**
   * Files to import
   */
  files: ImportFileHandle[];
  /**
   * Pattern to match the files
   */
  pattern: string;
  /**
   * Whether the file dialog is opened
   */
  fileDialogOpened: boolean;
  /**
   * Whether the dataset dialog is opened
   */
  datasetDialogOpened: boolean;
  /**
   * Whether the dataset is being imported from the file dialog
   */
  importing: boolean;
  /**
   * Label for the new dataset
   */
  newDatasetLabel: string;
  /**
   * Sample column name for multisample datasets (H5AD, Seurat, CSV/TSV)
   */
  sampleColumnName: string;
};

const emit = defineEmits<{ onClose: [navigated: boolean] }>();

const props = defineProps<{
  /** When specified, we are fixed to adding to a specific dataset */
  targetDataset?: PlId;
}>();

/** Case when importing to an existing dataset */
const targetDs = computed(() => {
  if (props.targetDataset)
    return app.model.data.datasets.find((ds) => ds.id === props.targetDataset);
  else return undefined;
});

/** Whether importing to an existing dataset */
const addingToFixedDataset = computed(() => targetDs.value !== undefined);

/** Read indices of the target dataset if importing to an existing dataset */
const targetDsReadIndices = computed(() => {
  const ds = targetDs.value;
  if (ds && (ds.content.type === "Fastq" || ds.content.type === "MultilaneFastq"))
    return ds.content.readIndices;
  else return ["R1"];
});

const app = useApp();
const reactiveFileContent = ReactiveFileContent.useGlobal();

/**
 * Whether the user has navigated to the dataset page
 */
const navigated = ref(false);

function doClose() {
  // The files to preprocess only feed this dialog's column list
  if (app.model.data.h5adFilesToPreprocess.length > 0) app.model.data.h5adFilesToPreprocess = [];
  if (app.model.data.seuratFilesToPreprocess.length > 0)
    app.model.data.seuratFilesToPreprocess = [];
  if (app.model.data.xsvFilesToPreprocess.length > 0) app.model.data.xsvFilesToPreprocess = [];
  app.showImportDataset = false;
  emit("onClose", navigated.value);
}

const data = reactive<ImportDatasetDialogData>({
  mode: targetDs.value ? "add-to-existing" : "create-new-dataset",
  targetAddDataset: targetDs.value?.id,
  datasetType: targetDs.value?.content.type,
  fileType: targetDs.value ? datasetTypes[targetDs.value.content.type].fileType : undefined,
  hasTags: targetDs.value ? datasetTypes[targetDs.value.content.type].hasTags : false,
  gzipped: targetDs.value?.content.gzipped ?? false,
  readIndices: targetDsReadIndices.value,
  files: [],
  newDatasetLabel: app.inferNewDatasetLabel(),
  pattern: "",
  fileDialogOpened: true,
  datasetDialogOpened: false,
  importing: false,
  sampleColumnName:
    targetDs.value?.content.type === "MultiSampleH5AD" ||
    targetDs.value?.content.type === "MultiSampleSeurat" ||
    targetDs.value?.content.type === "MultiSampleXsv"
      ? (targetDs.value.content.sampleColumnName ?? "")
      : "",
});

const isOneOfDialogsOpened = computed(() => data.fileDialogOpened || data.datasetDialogOpened);

watch(isOneOfDialogsOpened, (v) => {
  if (!v) {
    doClose();
  }
});

// Pattern compilation and file name matching
const { patternError, compiledPattern } = usePatternCompilation(data);

/** Records are stored under the target dataset's tag names; the workflow reads them by those names. */
const tagMismatchError = computed(() => {
  if (data.mode !== "add-to-existing") return undefined;
  const ds = app.model.data.datasets.find((ds) => ds.id === data.targetAddDataset);
  const pattern = compiledPattern.value;
  if (!ds || !pattern || !("tags" in ds.content)) return undefined;
  const expected = [...ds.content.tags].sort();
  if (_.isEqual(pattern.tags, expected)) return undefined;
  return `Pattern tags must match the dataset tags: ${expected.join(", ")}`;
});

/** Dataset type the last valid pattern implied */
let patternDatasetType: DSType | undefined;

function updateDataFromPattern(v: FileNamePattern | undefined) {
  if (v && !addingToFixedDataset.value) {
    // Keep the selected type while it fits the pattern and the type the pattern implies is unchanged
    const selected = data.datasetType && datasetTypes[data.datasetType];
    const keepType =
      selected !== undefined &&
      selected.fileType === v.fileContentType &&
      selected.hasTags === v.hasTagMatchers &&
      v.datasetType === patternDatasetType;
    if (!keepType) data.datasetType = v.datasetType;
    patternDatasetType = v.datasetType;
    data.fileType = v.fileContentType;
    data.hasTags = v.hasTagMatchers;
    data.gzipped = v.gzipped;

    const fileNames = parsedFiles.value.map((f) => f.fileName);
    data.readIndices = collectReadIndices(v, fileNames);
  }
}

watch(compiledPattern, (v) => updateDataFromPattern(v));

watch(
  () => data.datasetType,
  (value) => {
    if (value !== undefined) {
      updateDatasetType(value);
    }
  },
);

// Parsed files
const parsedFiles = useParsedFiles(data, compiledPattern);

// Whether any of the files matched the pattern
const hasMatchedFiles = computed(() => parsedFiles.value.filter((f) => f.match).length > 0);

const dsTypeOptions = computed(() => {
  if (!data.fileType) {
    return [];
  }
  const result = [];
  for (const [value, props] of Object.entries(datasetTypes)) {
    if (props.fileType === data.fileType && props.hasTags === data.hasTags) {
      result.push({ value, label: props.label });
    }
  }
  return result;
});

/** The separator a CSV/TSV file name implies; undefined for any other file */
function xsvTypeOfFile(fileName: string): "csv" | "tsv" | undefined {
  if (fileName.endsWith(".csv") || fileName.endsWith(".csv.gz")) return "csv";
  if (fileName.endsWith(".tsv") || fileName.endsWith(".tsv.gz")) return "tsv";
  return undefined;
}

/** Queues CSV/TSV files so the prerun reads their header (Multisample CSV/TSV) */
function queueXsvFiles(files: ImportFileHandle[]) {
  for (const file of files) {
    if (app.model.data.xsvFilesToPreprocess.some((item) => item.file === file)) continue;
    const fileName = extractFileName(getFilePathFromHandle(file));
    const xsvType = xsvTypeOfFile(fileName);
    if (xsvType)
      app.model.data.xsvFilesToPreprocess.push({
        file,
        xsvType,
        gzipped: fileName.endsWith(".gz"),
      });
  }
}

function updateDatasetType(datasetType: DSType | undefined) {
  if (datasetType === "MultiSampleXsv") {
    queueXsvFiles(parsedFiles.value.map((f) => f.handle));
  } else if (datasetType === "MultiSampleH5AD") {
    // Add already-loaded files to h5adFilesToPreprocess
    for (const file of parsedFiles.value.map((f) => f.handle)) {
      if (!app.model.data.h5adFilesToPreprocess.includes(file)) {
        app.model.data.h5adFilesToPreprocess.push(file);
      }
    }
  } else if (datasetType === "MultiSampleSeurat") {
    app.model.data.seuratFilesToPreprocess.push(...parsedFiles.value.map((f) => f.handle));
  }
}

// Add more files to the data
function addFiles(files: ImportFileHandle[]) {
  const fileNames = files.map((h) => extractFileName(getFilePathFromHandle(h)));
  if (data.files.length === 0) {
    const inferredPattern = inferFileNamePattern(fileNames);
    if (inferredPattern) {
      data.pattern = inferredPattern.pattern.rawPattern;
      updateDataFromPattern(inferredPattern.pattern);
      data.readIndices = inferredPattern.readIndices;
    }
    // @todo add some meaningful notification if failed to infer pattern
  }
  const datasetType = data.datasetType;
  data.files.push(...files);

  // Add files to h5adFilesToPreprocess for MultiSampleH5AD datasets
  if (datasetType === "MultiSampleH5AD") {
    for (const file of files) {
      if (!app.model.data.h5adFilesToPreprocess.includes(file)) {
        app.model.data.h5adFilesToPreprocess.push(file);
      }
    }
  } else if (datasetType === "MultiSampleSeurat") {
    for (const file of files) {
      if (!app.model.data.seuratFilesToPreprocess.includes(file)) {
        app.model.data.seuratFilesToPreprocess.push(file);
      }
    }
  } else if (datasetType === "MultiSampleXsv") {
    queueXsvFiles(files);
  }

  data.datasetDialogOpened = true;
}

const addToExistingOptions = computed<ListOption<PlId>[]>(() => {
  const types = new Set(dsTypeOptions.value.map((o) => o.value));
  return app.model.data.datasets
    .filter((ds) => types.has(ds.content.type))
    .map((ds) => ({
      value: ds.id,
      label: ds.label,
    }));
});

watch(addToExistingOptions, (ops) => {
  if (data.targetAddDataset && ops.find((o) => o.value === data.targetAddDataset)) return;
  if (ops.length === 0) data.targetAddDataset = undefined;
  else data.targetAddDataset = ops[0].value;
});

function getOrCreateGroup(groupLabels: Record<PlId, string>, groupName: string): PlId {
  const id = Object.entries(groupLabels).find(([, label]) => label === groupName)?.[0];
  if (id) return id as PlId;
  const newId = uniquePlId();
  groupLabels[newId] = groupName;
  return newId;
}

/** FASTA */
function addFastaDatasetContent(contentData: DSContentFasta["data"]) {
  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error("Dataset has read or lane matcher, trying to add fasta dataset");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    contentData[sampleId] = f.handle;
  }
}

/** FASTQ */
function addFastqDatasetContent(contentData: DSContentFastq["data"]) {
  if (compiledPattern.value?.hasLaneMatcher)
    throw new Error("Dataset has no lanes, trying to add data with lanes");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    const readIndex = getWellFormattedReadIndex(f.match);
    let fileGroup = contentData[sampleId];
    if (!fileGroup) {
      fileGroup = {};
      contentData[sampleId] = fileGroup;
    }
    fileGroup[readIndex] = f.handle;
  }
}

/** MULTI-LANE FASTQ */
function addMultilaneFastqDatasetContent(contentData: DSContentMultilaneFastq["data"]) {
  if (!compiledPattern.value?.hasLaneMatcher)
    throw new Error("Dataset has lanes, trying to add data without lanes");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    const lane = f.match.lane!.value;
    const readIndex = getWellFormattedReadIndex(f.match);

    let laneGroup = contentData[sampleId];
    if (!laneGroup) {
      laneGroup = {};
      contentData[sampleId] = laneGroup;
    }

    let fileGroup = laneGroup[lane];
    if (!fileGroup) {
      fileGroup = {};
      laneGroup[lane] = fileGroup;
    }

    fileGroup[readIndex] = f.handle;
  }
}

/** TAGGED FASTQ */
function addTaggedFastqDatasetContent(contentData: DSContentTaggedFastq["data"]) {
  const pattern = compiledPattern.value;
  if (!pattern) throw new Error("No pattern");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    const lane = f.match.lane?.value;
    const readIndex = getWellFormattedReadIndex(f.match);
    const tags = _.mapValues(f.match.tags!, (v) => v.value);

    let sampleRecords = contentData[sampleId];
    if (!sampleRecords) {
      sampleRecords = [];
      contentData[sampleId] = sampleRecords;
    }

    let sampleRecord = sampleRecords.find((r) => r.lane === lane && _.isEqual(r.tags, tags));
    if (!sampleRecord)
      sampleRecords.push(
        (sampleRecord = {
          tags,
          lane,
          files: {},
        }),
      );

    sampleRecord.files[readIndex] = f.handle;
  }
}

/** XSV */
function addXsvDatasetContent(contentData: DSContentXsv["data"]) {
  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error("Dataset has read or lane matcher, trying to add XSV dataset");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    contentData[sampleId] = f.handle;
  }
}

/** TAGGED XSV */
function addTaggedXsvDatasetContent(contentData: DSContentTaggedXsv["data"]) {
  const pattern = compiledPattern.value;
  if (!pattern) throw new Error("No pattern");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    const tags = _.mapValues(f.match.tags!, (v) => v.value);

    let sampleRecords = contentData[sampleId];
    if (!sampleRecords) {
      sampleRecords = [];
      contentData[sampleId] = sampleRecords;
    }

    let sampleRecord = sampleRecords.find((r) => _.isEqual(r.tags, tags));
    if (!sampleRecord)
      sampleRecords.push(
        (sampleRecord = {
          tags,
          file: f.handle,
        }),
      );
  }
}

/** Tagged AB1 */
function addTaggedAb1DatasetContent(contentData: DSContentTaggedAb1["data"]) {
  const pattern = compiledPattern.value;
  if (!pattern) throw new Error("No pattern");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    const tags = _.mapValues(f.match.tags!, (v) => v.value);

    let sampleRecords = contentData[sampleId];
    if (!sampleRecords) {
      sampleRecords = [];
      contentData[sampleId] = sampleRecords;
    }

    if (!sampleRecords.some((r) => _.isEqual(r.tags, tags)))
      sampleRecords.push({ tags, file: f.handle });
  }
}

/** CellRanger MTX */
function addCellRangerMtxDatasetContent(contentData: DSContentCellRangerMtx["data"]) {
  for (const f of parsedFiles.value) {
    if (!f.match || !f.match.cellRangerFileRole) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    const role = normalizeCellRangerFileRole(f.match.cellRangerFileRole.value);

    let fileGroup = contentData[sampleId];
    if (!fileGroup) {
      fileGroup = {};
      contentData[sampleId] = fileGroup;
    }
    fileGroup[role] = f.handle;
  }
}

/** H5AD */
function addH5adDatasetContent(contentData: DSContentH5ad["data"]) {
  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    contentData[sampleId] = f.handle;
  }
}

/** H5 */
function addH5DatasetContent(contentData: DSContentH5["data"]) {
  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    contentData[sampleId] = f.handle;
  }
}

/** Seurat */
function addSeuratDatasetContent(contentData: DSContentSeurat["data"]) {
  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const sample = f.match.sample.value;
    const sampleId = getOrCreateSample(app, sample);
    contentData[sampleId] = f.handle;
  }
}

/** Multi-Sample H5AD */
function addMultiSampleH5adDatasetContent(
  groupLabels: Record<PlId, string>,
  contentData: DSContentMultiSampleH5ad["data"],
) {
  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error("Dataset has read or lane matcher, trying to add H5AD dataset");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const group = f.match.sample.value;
    const sampleId = getOrCreateGroup(groupLabels, group);
    contentData[sampleId] = f.handle;
  }
}

/** Multi-Sample Seurat */
function addMultiSampleSeuratDatasetContent(
  groupLabels: Record<PlId, string>,
  contentData: DSContentMultiSampleSeurat["data"],
) {
  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error("Dataset has read or lane matcher, trying to add Seurat dataset");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const group = f.match.sample.value;
    const sampleId = getOrCreateGroup(groupLabels, group);
    contentData[sampleId] = f.handle;
  }
}

/** Bulk Count Matrix */
function addBulkCountMatrixDatasetContent(
  groupLabels: Record<PlId, string>,
  contentData: DSContentBulkCountMatrix["data"],
) {
  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error("Dataset has read or lane matcher, trying to add XSV dataset");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const group = f.match.sample.value;
    const sampleId = getOrCreateGroup(groupLabels, group);
    contentData[sampleId] = f.handle;
  }
}

/** Multi-Sample CSV/TSV */
function addMultiSampleXsvDatasetContent(
  groupLabels: Record<PlId, string>,
  contentData: DSContentMultiSampleXsv["data"],
) {
  if (compiledPattern.value?.hasLaneMatcher || compiledPattern.value?.hasReadIndexMatcher)
    throw new Error("Dataset has read or lane matcher, trying to add multisample XSV dataset");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const group = f.match.sample.value;
    const groupId = getOrCreateGroup(groupLabels, group);
    contentData[groupId] = f.handle;
  }
}

/** Multiplexed FASTQ */
function addMultiplexedFastqDatasetContent(
  groupLabels: Record<PlId, string>,
  contentData: DSContentMultiplexedFastq["data"],
) {
  if (compiledPattern.value?.hasLaneMatcher)
    throw new Error("Dataset has no lanes, trying to add data with lanes");

  for (const f of parsedFiles.value) {
    if (!f.match) continue;
    const group = f.match.sample.value;
    const groupId = getOrCreateGroup(groupLabels, group);
    const readIndex = getWellFormattedReadIndex(f.match);
    let fileGroup = contentData[groupId];
    if (!fileGroup) {
      fileGroup = {};
      contentData[groupId] = fileGroup;
    }
    fileGroup[readIndex] = f.handle;
  }
}

async function createOrAdd() {
  try {
    data.importing = true;
    console.log("createOrAdd", data.mode);
    if (data.mode === "add-to-existing") await addToExistingDataset();
    else await createNewDataset();
  } finally {
    doClose();
  }
}

async function addToExistingDataset() {
  const datasetId = data.targetAddDataset!;
  const dataset = app.model.data.datasets.find((ds) => ds.id === datasetId);
  if (dataset === undefined) throw new Error("Dataset not found");

  switch (dataset.content.type) {
    case "Fasta":
      addFastaDatasetContent(dataset.content.data);
      break;
    case "Fastq":
      addFastqDatasetContent(dataset.content.data);
      break;
    case "MultilaneFastq":
      addMultilaneFastqDatasetContent(dataset.content.data);
      break;
    case "MultiplexedFastq":
      addMultiplexedFastqDatasetContent(dataset.content.groupLabels, dataset.content.data);
      break;
    case "Xsv":
      addXsvDatasetContent(dataset.content.data);
      break;
    case "TaggedXsv":
      addTaggedXsvDatasetContent(dataset.content.data);
      break;
    case "TaggedAb1":
      addTaggedAb1DatasetContent(dataset.content.data);
      break;
    case "CellRangerMTX":
      addCellRangerMtxDatasetContent(dataset.content.data);
      break;
    case "H5AD":
      addH5adDatasetContent(dataset.content.data);
      break;
    case "H5":
      addH5DatasetContent(dataset.content.data);
      break;
    case "Seurat":
      addSeuratDatasetContent(dataset.content.data);
      break;
    case "MultiSampleH5AD":
      addMultiSampleH5adDatasetContent(dataset.content.groupLabels, dataset.content.data);
      // Update sample column name if it was changed
      if (data.sampleColumnName) {
        dataset.content.sampleColumnName = data.sampleColumnName;
      }
      break;
    case "MultiSampleSeurat":
      addMultiSampleSeuratDatasetContent(dataset.content.groupLabels, dataset.content.data);
      // Update sample column name if it was changed
      if (data.sampleColumnName) {
        dataset.content.sampleColumnName = data.sampleColumnName;
      }
      break;
    case "BulkCountMatrix":
      addBulkCountMatrixDatasetContent(dataset.content.groupLabels, dataset.content.data);
      break;
    case "MultiSampleXsv":
      // The dataset keeps its sample column; the new files were checked to have it
      addMultiSampleXsvDatasetContent(dataset.content.groupLabels, dataset.content.data);
      break;
    default:
      throw new Error("Unknown dataset type");
  }

  await app.navigateTo(`/dataset?id=${datasetId}`);
  navigated.value = true;
}

const xsvType = (): "csv" | "tsv" => {
  const type = matchedXsvType.value;
  if (type === undefined) throw new Error("Files are not all csv or tsv");
  return type;
};

async function createNewDataset() {
  const newDatasetId = uniquePlId();

  const pattern = compiledPattern.value;
  const datasetType = data.datasetType;
  if (!datasetType) throw new Error("Dataset type is not set");
  if (!pattern) throw new Error("Pattern type is not set");
  switch (datasetType) {
    case "TaggedXsv": {
      const contentData: DSContentTaggedXsv["data"] = {};
      addTaggedXsvDatasetContent(contentData);
      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "TaggedXsv",
          xsvType: xsvType(),
          gzipped: data.gzipped,
          tags: pattern.tags,
          data: contentData,
        },
      });
      break;
    }
    case "TaggedAb1": {
      const contentData: DSContentTaggedAb1["data"] = {};
      addTaggedAb1DatasetContent(contentData);
      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "TaggedAb1",
          gzipped: data.gzipped,
          tags: pattern.tags,
          data: contentData,
        },
      });
      break;
    }
    case "Xsv": {
      const contentData: DSContentXsv["data"] = {};
      addXsvDatasetContent(contentData);
      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "Xsv",
          xsvType: xsvType(),
          gzipped: data.gzipped,
          data: contentData,
        },
      });
      break;
    }
    case "Fasta": {
      const contentData: DSContentFasta["data"] = {};
      addFastaDatasetContent(contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "Fasta",
          gzipped: data.gzipped,
          data: contentData,
        },
      });
      break;
    }
    case "TaggedFastq": {
      const contentData: DSContentTaggedFastq["data"] = {};
      addTaggedFastqDatasetContent(contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "TaggedFastq",
          gzipped: data.gzipped,
          tags: pattern.tags,
          hasLanes: pattern.hasLaneMatcher,
          readIndices: data.readIndices as ReadIndices,
          data: contentData,
        },
      });
      break;
    }
    case "MultilaneFastq": {
      const contentData: DSContentMultilaneFastq["data"] = {};
      addMultilaneFastqDatasetContent(contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "MultilaneFastq",
          gzipped: data.gzipped,
          readIndices: data.readIndices as ReadIndices,
          data: contentData,
        },
      });
      break;
    }
    case "Fastq": {
      const contentData: DSContentFastq["data"] = {};
      addFastqDatasetContent(contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "Fastq",
          gzipped: data.gzipped,
          readIndices: data.readIndices as ReadIndices,
          data: contentData,
        },
      });
      break;
    }
    case "CellRangerMTX": {
      const contentData: DSContentCellRangerMtx["data"] = {};
      addCellRangerMtxDatasetContent(contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "CellRangerMTX",
          gzipped: data.gzipped,
          data: contentData,
        },
      });
      break;
    }
    case "H5AD": {
      const contentData: DSContentH5ad["data"] = {};
      addH5adDatasetContent(contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "H5AD",
          gzipped: false,
          data: contentData,
        },
      });
      break;
    }
    case "H5": {
      const contentData: DSContentH5["data"] = {};
      addH5DatasetContent(contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "H5",
          gzipped: false,
          data: contentData,
        },
      });
      break;
    }
    case "Seurat": {
      const contentData: DSContentSeurat["data"] = {};
      addSeuratDatasetContent(contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "Seurat",
          gzipped: false,
          data: contentData,
        },
      });
      break;
    }
    case "MultiSampleH5AD": {
      const groupLabels: Record<PlId, string> = {};
      const contentData: DSContentMultiSampleH5ad["data"] = {};
      addMultiSampleH5adDatasetContent(groupLabels, contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "MultiSampleH5AD",
          gzipped: false,
          sampleGroups: undefined,
          data: contentData,
          groupLabels: groupLabels,
          sampleColumnName: data.sampleColumnName,
        },
      });
      break;
    }
    case "MultiSampleSeurat": {
      const groupLabels: Record<PlId, string> = {};
      const contentData: DSContentMultiSampleSeurat["data"] = {};
      addMultiSampleSeuratDatasetContent(groupLabels, contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "MultiSampleSeurat",
          gzipped: false,
          sampleGroups: undefined,
          data: contentData,
          groupLabels: groupLabels,
          sampleColumnName: data.sampleColumnName,
        },
      });
      break;
    }
    case "BulkCountMatrix": {
      const groupLabels: Record<PlId, string> = {};
      const contentData: DSContentBulkCountMatrix["data"] = {};
      addBulkCountMatrixDatasetContent(groupLabels, contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "BulkCountMatrix",
          gzipped: data.gzipped,
          xsvType: xsvType(),
          sampleGroups: undefined,
          data: contentData,
          groupLabels: groupLabels,
        },
      });
      break;
    }
    case "MultiSampleXsv": {
      const groupLabels: Record<PlId, string> = {};
      const contentData: DSContentMultiSampleXsv["data"] = {};
      addMultiSampleXsvDatasetContent(groupLabels, contentData);

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "MultiSampleXsv",
          gzipped: data.gzipped,
          xsvType: xsvType(),
          sampleGroups: undefined,
          data: contentData,
          groupLabels: groupLabels,
          sampleColumnName: data.sampleColumnName,
        },
      });
      break;
    }
    case "MultiplexedFastq": {
      const groupLabels: Record<PlId, string> = {};
      const contentData: DSContentMultiplexedFastq["data"] = {};
      addMultiplexedFastqDatasetContent(groupLabels, contentData);

      // For MultiplexedFastq, initialize with completely empty sampleGroups
      // Samples will be imported later via the samplesheet import dialog
      const sampleGroups: Record<PlId, Record<PlId, string>> = {};

      app.model.data.datasets.push({
        label: data.newDatasetLabel,
        id: newDatasetId,
        content: {
          type: "MultiplexedFastq",
          gzipped: data.gzipped,
          readIndices: data.readIndices as ReadIndices,
          sampleGroups: sampleGroups,
          data: contentData,
          groupLabels: groupLabels,
          // Multiplexing rules — operator declares tags and rules in the
          // dataset page after creation. Empty by default.
          barcodeTags: [],
          barcodeRules: [],
        },
      });
      break;
    }
    default:
      throw new Error("Unknown dataset type: " + datasetType);
  }
  await app.allSettled();
  await app.navigateTo(`/dataset?id=${newDatasetId}`);
  navigated.value = true;
}

const isMultiSampleType = computed(
  () =>
    data.datasetType === "MultiSampleH5AD" ||
    data.datasetType === "MultiSampleSeurat" ||
    data.datasetType === "MultiSampleXsv",
);

/** Multisample CSV/TSV: columns come as JSON lists from the header read, not as files */
const isMultiSampleXsv = computed(() => data.datasetType === "MultiSampleXsv");

/** How the column picker names the file kind and where its columns come from */
const multiSampleTexts = computed(() => {
  if (data.datasetType === "MultiSampleH5AD")
    return { file: "H5AD", source: "anndata.obs", picker: "Sample Column Name in anndata.obs" };
  if (data.datasetType === "MultiSampleXsv")
    return { file: "CSV or TSV", source: "the header", picker: "Sample Column" };
  return {
    file: "Seurat RDS",
    source: "the Seurat metadata",
    picker: "Sample Column Name in Seurat metadata",
  };
});

/** Files that match the pattern; only these are imported */
const matchedFiles = computed(() => parsedFiles.value.filter((f) => f.match));

/** The separator the matched files share; undefined when they mix csv and tsv */
const matchedXsvType = computed(() => {
  const types = new Set(matchedFiles.value.map((f) => xsvTypeOfFile(f.fileName)));
  return types.size === 1 ? [...types][0] : undefined;
});

/** Why the matched CSV/TSV files can't be imported: mixed separators, or a separator or compression unlike the target dataset's */
const xsvFilesError = computed(() => {
  if (!data.datasetType || datasetTypes[data.datasetType].fileType !== "Xsv") return undefined;
  if (matchedFiles.value.length === 0) return undefined;
  const type = matchedXsvType.value;
  if (type === undefined) return "Files must be all CSV or all TSV.";
  if (data.mode !== "add-to-existing") return undefined;
  const ds = app.model.data.datasets.find((ds) => ds.id === data.targetAddDataset);
  if (!ds || !("xsvType" in ds.content)) return undefined;
  if (ds.content.xsvType !== type)
    return `The dataset holds ${ds.content.xsvType.toUpperCase()} files; these files are ${type.toUpperCase()}.`;
  const gzipped = ds.content.gzipped;
  if (matchedFiles.value.some((f) => f.fileName.endsWith(".gz") !== gzipped))
    return `The dataset holds ${gzipped ? "gzipped (.gz)" : "uncompressed"} files; all added files must be too.`;
  return undefined;
});

/** Sample column of the Multisample CSV/TSV dataset files are added to; it stays fixed */
const targetXsvSampleColumn = computed(() => {
  if (data.mode !== "add-to-existing") return undefined;
  const content = app.model.data.datasets.find((ds) => ds.id === data.targetAddDataset)?.content;
  return content?.type === "MultiSampleXsv" ? content.sampleColumnName : undefined;
});

watch(
  targetXsvSampleColumn,
  (column) => {
    if (column !== undefined) data.sampleColumnName = column;
  },
  { immediate: true },
);

/** Column names per matched file, keyed by file handle; a file is absent until its list has loaded */
const columnsByFile = computed(() => {
  const result: Record<string, string[]> = {};
  if (isMultiSampleXsv.value) {
    const xsvColumns = app.model.outputs.availableXsvColumns ?? {};
    for (const { handle } of matchedFiles.value) {
      const names = xsvColumns[handle];
      if (names !== undefined) result[handle] = names;
    }
    return result;
  }
  const columns = app.model.outputs.availableColumns ?? {};
  for (const { handle } of matchedFiles.value) {
    const columnsCsv = columns[handle];
    // ReactiveFileContent never loads a 0-byte file, so its content is taken as empty
    const content =
      columnsCsv?.size === 0 ? "" : reactiveFileContent.getContentString(columnsCsv?.handle)?.value;
    if (content !== undefined)
      result[handle] = content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
  }
  return result;
});

/** Error of the prerun that lists the columns, e.g. a file that is not a valid H5AD */
const columnsError = computed(() =>
  isMultiSampleXsv.value
    ? app.model.outputErrors.availableXsvColumns?.message
    : app.model.outputErrors.availableColumns?.message,
);

/** Names of the selected files the error is about; the error text holds their upload handles */
const unreadableFileNames = computed(() =>
  parsedFiles.value.filter((f) => columnsError.value?.includes(f.handle)).map((f) => f.fileName),
);

/** Waiting until every matched file has its column list */
const loadingColumns = computed(() =>
  matchedFiles.value.some((f) => !(f.handle in columnsByFile.value)),
);

/** Matched files whose column list is empty */
const filesWithoutColumns = computed(() =>
  matchedFiles.value
    .filter((f) => columnsByFile.value[f.handle]?.length === 0)
    .map((f) => f.fileName),
);

// Column names of the matched files: for Multisample CSV/TSV only those every file has, otherwise all
const availableColumnsOptions = computed<ListOption<string>[]>(() => {
  const lists = Object.values(columnsByFile.value);
  const names = isMultiSampleXsv.value
    ? (lists[0] ?? []).filter((col) => lists.every((list) => list.includes(col)))
    : [...new Set(lists.flat())];
  return names.map((col) => ({ value: col, label: col }));
});

/** Matched files that lack the chosen sample column (Multisample CSV/TSV) */
const filesWithoutSampleColumn = computed(() => {
  if (!isMultiSampleXsv.value || !data.sampleColumnName) return [];
  return matchedFiles.value
    .filter((f) => {
      const columns = columnsByFile.value[f.handle];
      return columns !== undefined && !columns.includes(data.sampleColumnName);
    })
    .map((f) => f.fileName);
});

// Watch for when columns become available to pick a sample column
watch(availableColumnsOptions, (options) => {
  if (options.length > 0) {
    // Auto-select a default sample column name only if not already set
    // (e.g., from existing dataset or previous selection)
    if (!data.sampleColumnName) {
      const priorityNames = ["sample", "samples", "replicate", "replicates"];
      const foundOption = options.find((opt) =>
        priorityNames.some((name) => opt.value.toLowerCase() === name),
      );
      data.sampleColumnName = foundOption ? foundOption.value : options[0].value;
    }
  }
});

const canCreateOrAdd = computed(() => {
  const basicConditions =
    hasMatchedFiles.value &&
    tagMismatchError.value === undefined &&
    (data.mode === "create-new-dataset" || data.targetAddDataset !== undefined) &&
    data.datasetType !== undefined &&
    xsvFilesError.value === undefined &&
    filesWithoutSampleColumn.value.length === 0 &&
    // A multisample dataset needs a non-empty column list for every matched file
    (!isMultiSampleType.value ||
      matchedFiles.value.every((f) => (columnsByFile.value[f.handle]?.length ?? 0) > 0)) &&
    // This prevents selecting fasta as type while having read index matcher in pattern
    (data.readIndices.length !== 0 ||
      (compiledPattern.value?.hasReadIndexMatcher === false &&
        compiledPattern.value?.hasLaneMatcher === false));

  // For MultiSampleH5AD and MultiSampleXsv datasets, also require sampleColumnName
  if (data.datasetType === "MultiSampleH5AD" || data.datasetType === "MultiSampleXsv") {
    return basicConditions && data.sampleColumnName !== "";
  }

  return basicConditions;
});
</script>

<template>
  <PlDialogModal v-model="data.datasetDialogOpened" width="70%" :close-on-outside-click="false">
    <template #title>Import files</template>

    <PlBtnGroup v-model="data.mode" :options="modesOptions" :disabled="addingToFixedDataset" />

    <PlRow alignCenter>
      <PlTextField
        v-if="data.mode === 'create-new-dataset'"
        v-model="data.newDatasetLabel"
        label="Dataset Name"
        class="flex-grow-1"
        :disabled="addingToFixedDataset"
      />
      <PlDropdown
        v-else
        v-model="data.targetAddDataset"
        :options="addToExistingOptions"
        :disabled="addingToFixedDataset"
        label="Dataset"
        placeholder="Select dataset"
        required
        class="flex-grow-1"
      />
      <PlDropdown
        v-model="data.datasetType"
        :options="dsTypeOptions"
        :required="true"
        :disabled="data.datasetType && addingToFixedDataset"
        label="Type"
        error=""
        placeholder="Select type"
        :style="{ flexBasis: '180px', flexShrink: 0 }"
      />

      <PlCheckbox v-model="data.gzipped" disabled> Gzipped </PlCheckbox>
    </PlRow>

    <PlTextField v-model="data.pattern" label="Pattern" :error="patternError ?? tagMismatchError" />

    <PlAlert v-if="xsvFilesError" type="error">{{ xsvFilesError }}</PlAlert>

    <template v-if="isMultiSampleType">
      <PlAlert v-if="columnsError" type="error">
        Could not read
        {{ unreadableFileNames.length > 0 ? unreadableFileNames.join(", ") : "the files" }}. Please
        check that each file is a valid {{ multiSampleTexts.file }} file.
      </PlAlert>
      <div v-else-if="loadingColumns">Parsing files to extract column information...</div>
      <template v-else>
        <PlAlert v-if="filesWithoutColumns.length > 0" type="warn">
          No columns found in {{ multiSampleTexts.source }} of {{ filesWithoutColumns.join(", ") }}.
        </PlAlert>
        <PlAlert v-if="filesWithoutSampleColumn.length > 0" type="error">
          No column "{{ data.sampleColumnName }}" in {{ filesWithoutSampleColumn.join(", ") }}.
        </PlAlert>
        <PlRow v-if="availableColumnsOptions.length > 0" alignCenter>
          <PlDropdown
            v-model="data.sampleColumnName"
            :label="multiSampleTexts.picker"
            :options="availableColumnsOptions"
            :disabled="targetXsvSampleColumn !== undefined"
            :error="undefined"
            class="flex-grow-1"
          />
        </PlRow>
      </template>
    </template>

    <ParsedFilesList :items="parsedFiles" />

    <PlBtnSecondary @click="() => (data.fileDialogOpened = true)">
      + add more files
    </PlBtnSecondary>

    <template #actions>
      <PlBtnPrimary :disabled="!canCreateOrAdd" :loading="data.importing" @click="createOrAdd">
        {{ data.mode === "create-new-dataset" ? "Create" : "Add" }}
      </PlBtnPrimary>

      <PlBtnGhost @click.stop="() => doClose()"> Cancel </PlBtnGhost>
    </template>
  </PlDialogModal>

  <PlFileDialog
    v-model="data.fileDialogOpened"
    :close-on-outside-click="false"
    :multi="true"
    title="Select files to import"
    @import:files="(e) => addFiles(e.files)"
  />
</template>
