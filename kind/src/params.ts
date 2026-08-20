import { assertParamsObject } from "@platforma-sdk/block-kind";
import { isImportFileHandleIndex, isImportFileHandleUpload } from "@milaboratories/pl-model-common";
import { isBoolean, isPlainObject, isString } from "es-toolkit";
import type {
  BlockParams,
  DSAny,
  DSType,
  ImportFileHandle,
  MTColumn,
  MTValueType,
  PlId,
} from "./types";

/**
 * The contract at runtime, for params that arrive from a template file rather
 * than from typed code.
 *
 * Each field the contract names is read and checked; a key it does not name is
 * dropped by never being read, so it needs no rejection here. Params written
 * against a different version of the contract are caught by the version in the
 * template entry's `{name}@{selector}` reference, not by a key-set check.
 */
export function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const params: Record<string, unknown> = {};
  for (const [field, { is, must }] of Object.entries(CONTRACT)) {
    const raw = value[field];
    if (raw === undefined) continue;
    if (!is(raw)) throw new Error(`'${field}' must be ${must}.`);
    params[field] = raw;
  }
  // Every value placed here passed its own field's guard, and `CONTRACT` is
  // proven exhaustive over `BlockParams` by the `satisfies` below.
  return params as BlockParams;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Guard<T> = (value: unknown) => value is T;

/** A guard plus how to finish the sentence "'field' must be …". */
type Check<T> = { readonly is: Guard<T>; readonly must: string };

function check<T>(is: Guard<T>, must: string): Check<T> {
  return { is, must };
}

function arrayOf<T>(item: Guard<T>): Guard<T[]> {
  return (v): v is T[] => Array.isArray(v) && v.every((e) => item(e));
}

function recordOf<T>(item: Guard<T>): Guard<Record<string, T>> {
  return (v): v is Record<string, T> => isPlainObject(v) && Object.values(v).every((e) => item(e));
}

/**
 * A guard over the keys of one of the tag sets below, so the runtime check and
 * the type it guards are both read off the same object.
 */
function keyOf<T extends string>(set: Record<T, true>): Guard<T> {
  return (v): v is T => isString(v) && v in set;
}

function keyList(set: Record<string, true>): string {
  return Object.keys(set).join(", ");
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

/**
 * A `PlId` is a branded 24-char base32 string, but the brand is erased at
 * runtime and the block treats these ids as opaque keys, so the envelope check
 * is the string test.
 */
const isPlId = isString as Guard<PlId>;

/**
 * Both handle forms are accepted. The projection only sends `index://` handles,
 * but `upload://` is a legitimate value of the type, and the two SDK guards are
 * prefix tests — the cast only gets a checked string past a signature that
 * expects the union.
 */
const isFileHandle: Guard<ImportFileHandle> = (v): v is ImportFileHandle =>
  isString(v) &&
  (isImportFileHandleIndex(v as ImportFileHandle) ||
    isImportFileHandleUpload(v as ImportFileHandle));

/**
 * A metadata column at the envelope: its identity, its declared value type, and
 * nothing about the values. What the values mean is settled where they are used.
 */
const isMetadataColumn: Guard<MTColumn> = (v): v is MTColumn =>
  isPlainObject(v) &&
  isString(v.id) &&
  isString(v.label) &&
  isBoolean(v.global) &&
  keyOf(MT_VALUE_TYPES)(v.valueType);

/**
 * A dataset at the envelope: its identity and the discriminator of its content.
 *
 * The file handles inside are deliberately not walked. Their shape differs per
 * dataset kind, and whether a handle still resolves is knowable only where the
 * block runs, not here — the same limit every kind has on a handle. Likewise
 * the per-sample and per-group maps: the block's own `args` is what holds
 * datasets, groups and rules to each other, and rejecting a half-configured
 * study here would refuse states the editor can reach.
 */
const isDataset: Guard<DSAny> = (v): v is DSAny =>
  isPlainObject(v) &&
  isString(v.id) &&
  isString(v.label) &&
  isPlainObject(v.content) &&
  keyOf(DATASET_TYPES)(v.content.type) &&
  isBoolean(v.content.gzipped);

/**
 * The contract, field by field, at runtime.
 *
 * The `satisfies` clause is the drift guard: it demands an entry for every key
 * `BlockParams` declares, and types each guard against that key's own type. Add
 * a field to the contract and this stops compiling until the check exists —
 * which matters here because every field is optional, so a parser that simply
 * forgot one would otherwise return a valid `BlockParams` and say nothing.
 */
const CONTRACT = {
  datasets: check(arrayOf(isDataset), `an array of datasets of: ${keyList(DATASET_TYPES)}`),
  metadata: check(
    arrayOf(isMetadataColumn),
    `an array of metadata columns valued: ${keyList(MT_VALUE_TYPES)}`,
  ),
  sampleIds: check(arrayOf(isPlId), "an array of sample ids"),
  sampleLabelColumnLabel: check(isString, "a string"),
  sampleLabels: check(recordOf(isString), "an object of sample id to label"),
  h5adFilesToPreprocess: check(arrayOf(isFileHandle), "an array of file handles"),
  seuratFilesToPreprocess: check(arrayOf(isFileHandle), "an array of file handles"),
} satisfies { [K in keyof BlockParams]-?: Check<NonNullable<BlockParams[K]>> };
