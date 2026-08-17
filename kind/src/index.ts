import { assertParamsObject, defineBlockKind } from "@platforma-sdk/block-kind";
import { name, version } from "../package.json" with { type: "json" };
import type { DSAny, DSType, ImportFileHandle, MTColumn, MTValueType, PlId } from "./types";

export * from "./types";

/**
 * This block's init-params contract — the study setup a creator or a project
 * template supplies to seed a new instance: which metadata columns the study
 * collects, how the sample column is named, how its datasets are configured,
 * and whichever of its files can be resolved from where the block lands.
 *
 * A file travels only when it is a storage reference: `index://` names a
 * `{storageId, path}` any installation carrying that storage can resolve, while
 * `upload://` carries a local path signed with the installation's own secret.
 * Samples travel with the files that produced them and not otherwise — samples
 * are created by importing files, so a sample arriving without its file would
 * be a row with metadata and no data, for the user to delete.
 *
 * Which of the two a given dataset gets is the exporting block's call, not this
 * contract's: both a fully populated dataset and a bare shell are ordinary
 * states of the block, so both are valid params.
 *
 * Every field is optional because a block may be created without a template, so
 * `init` keeps a default for each.
 */
export type BlockParams = Partial<{
  datasets: DSAny[];
  metadata: MTColumn[];
  sampleIds: PlId[];
  sampleLabelColumnLabel: string;
  sampleLabels: Record<PlId, string>;
  h5adFilesToPreprocess: ImportFileHandle[];
  seuratFilesToPreprocess: ImportFileHandle[];
}>;

/**
 * The same contract at runtime, for params that arrive from a template file
 * rather than from typed code — the only point that can catch a hand-written
 * entry being wrong.
 *
 * Checks are at the envelope: an entry is an object, its discriminator is one
 * this block knows, its scalar fields are the right primitives. What a value
 * *means* is settled where it is used — the block's own `args` is what holds
 * datasets, groups and rules to each other, and rejecting a half-configured
 * study here would refuse states the editor can reach.
 *
 * The file handles inside a dataset are deliberately not walked. Their shape
 * differs per dataset kind, and whether a handle still resolves is knowable only
 * where the block runs, not here — the same limit every kind has on a handle.
 */
function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const {
    datasets,
    metadata,
    sampleIds,
    sampleLabelColumnLabel,
    sampleLabels,
    h5adFilesToPreprocess,
    seuratFilesToPreprocess,
  } = value;

  if (sampleLabelColumnLabel !== undefined && typeof sampleLabelColumnLabel !== "string") {
    throw new Error("'sampleLabelColumnLabel' must be a string.");
  }

  if (metadata !== undefined) {
    if (!Array.isArray(metadata)) throw new Error("'metadata' must be an array of columns.");
    metadata.forEach(assertMetadataColumn);
  }

  if (datasets !== undefined) {
    if (!Array.isArray(datasets)) throw new Error("'datasets' must be an array of datasets.");
    datasets.forEach(assertDataset);
  }

  assertStringArray(sampleIds, "sampleIds");
  assertStringArray(h5adFilesToPreprocess, "h5adFilesToPreprocess");
  assertStringArray(seuratFilesToPreprocess, "seuratFilesToPreprocess");

  if (sampleLabels !== undefined) {
    assertObject(sampleLabels, "'sampleLabels'");
    for (const [id, label] of Object.entries(sampleLabels)) {
      if (typeof label !== "string") {
        throw new Error(`'sampleLabels' entry ${JSON.stringify(id)} must be a string.`);
      }
    }
  }

  return {
    datasets: datasets as DSAny[] | undefined,
    metadata: metadata as MTColumn[] | undefined,
    sampleIds: sampleIds as PlId[] | undefined,
    sampleLabelColumnLabel,
    sampleLabels: sampleLabels as Record<PlId, string> | undefined,
    h5adFilesToPreprocess: h5adFilesToPreprocess as ImportFileHandle[] | undefined,
    seuratFilesToPreprocess: seuratFilesToPreprocess as ImportFileHandle[] | undefined,
  };
}

function assertStringArray(value: unknown, field: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new Error(`'${field}' must be an array of strings.`);
  }
}

/**
 * The value types a metadata column may declare, as a runtime set. `satisfies
 * Record<MTValueType, true>` is what keeps it in step: a value type added to the
 * union and forgotten here fails to compile, rather than turning into a kind
 * that refuses a correct file.
 */
const MT_VALUE_TYPES = {
  Long: true,
  Double: true,
  String: true,
} as const satisfies Record<MTValueType, true>;

/** The dataset kinds this block knows, kept in step with the union the same way. */
const DATASET_TYPES = {
  Fastq: true,
  MultilaneFastq: true,
  TaggedFastq: true,
  Fasta: true,
  Xsv: true,
  TaggedXsv: true,
  BulkCountMatrix: true,
  CellRangerMTX: true,
  MultiplexedFastq: true,
  H5AD: true,
  H5: true,
  Seurat: true,
  MultiSampleH5AD: true,
  MultiSampleSeurat: true,
} as const satisfies Record<DSType, true>;

function assertMetadataColumn(column: unknown, index: number): void {
  const where = `metadata column ${index}`;
  assertObject(column, where);

  if (typeof column.id !== "string") throw new Error(`'id' of ${where} must be a string.`);
  if (typeof column.label !== "string") throw new Error(`'label' of ${where} must be a string.`);
  if (typeof column.global !== "boolean")
    throw new Error(`'global' of ${where} must be a boolean.`);
  if (!isKeyOf(MT_VALUE_TYPES, column.valueType)) {
    throw new Error(
      `'valueType' of ${where} must be one of ${keyList(MT_VALUE_TYPES)}, not ${JSON.stringify(column.valueType)}.`,
    );
  }
}

function assertDataset(dataset: unknown, index: number): void {
  const where = `dataset ${index}`;
  assertObject(dataset, where);

  if (typeof dataset.id !== "string") throw new Error(`'id' of ${where} must be a string.`);
  if (typeof dataset.label !== "string") throw new Error(`'label' of ${where} must be a string.`);

  const content = dataset.content;
  assertObject(content, `'content' of ${where}`);

  if (!isKeyOf(DATASET_TYPES, content.type)) {
    throw new Error(
      `'content.type' of ${where} must be one of ${keyList(DATASET_TYPES)}, not ${JSON.stringify(content.type)}.`,
    );
  }
  if (typeof content.gzipped !== "boolean") {
    throw new Error(`'content.gzipped' of ${where} must be a boolean.`);
  }
}

function assertObject(value: unknown, where: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where} must be an object.`);
  }
}

function isKeyOf(set: Record<string, true>, key: unknown): key is string {
  return typeof key === "string" && key in set;
}

function keyList(set: Record<string, true>): string {
  return Object.keys(set).join(", ");
}

// Identity (`name`/`version`) comes from this package's own `package.json`, so
// the on-wire `{name}@{version}` reference can never drift from what npm
// publishes; the bundler inlines the JSON import.
export const kind = defineBlockKind<BlockParams>({
  name,
  version,
  parseInitializationParams,
});
