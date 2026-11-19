import type { ImportFileHandle } from "@platforma-sdk/model";
import type {
  DSAny,
  DSGrouped,
  MTColumn,
  PlId,
} from "@platforma-open/milaboratories.samples-and-data.kind";

// The dataset and metadata shapes are the block's init-params contract, so they
// are declared by the kind and re-exported here: the model depends on the kind,
// never the other way round, and every existing `from "...model"` import keeps
// resolving.
export * from "@platforma-open/milaboratories.samples-and-data.kind";

// Block-local rule id generator. Avoids `uniquePlId` / `crypto.randomUUID`
// because the model migration step runs in a sandbox without the Web Crypto
// API. Ten base36 random chars — these ids never leave the block.
export function makeRuleId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function isGroupedDataset(ds: DSAny): ds is DSGrouped {
  return (
    ds.content.type === "BulkCountMatrix" ||
    ds.content.type === "MultiSampleH5AD" ||
    ds.content.type === "MultiplexedFastq" ||
    ds.content.type === "MultiSampleSeurat" ||
    ds.content.type === "MultiSampleXsv"
  );
}

export type LegacyBlockArgs = {
  sampleIds: PlId[];
  sampleLabelColumnLabel: string;
  sampleLabels: Record<PlId, string>;
  metadata: MTColumn[];
  datasets: DSAny[];
  h5adFilesToPreprocess: ImportFileHandle[];
  seuratFilesToPreprocess: ImportFileHandle[];
  metadataUploadHandle?: ImportFileHandle;
};

export type LegacyBlockUiState = {
  suggestedImport: boolean;
};

export type BlockDataV20260427 = {
  datasets: DSAny[];
  metadata: MTColumn[];
  sampleIds: PlId[];
  sampleLabelColumnLabel: string;
  sampleLabels: Record<PlId, string>;
  h5adFilesToPreprocess: ImportFileHandle[];
  seuratFilesToPreprocess: ImportFileHandle[];
  metadataUploadHandle?: ImportFileHandle;
  suggestedImport: boolean;
};

/**
 * V20260428 only differs from V20260427 in `DSContentMultiplexedFastq`, which
 * gains `barcodeTags` and `barcodeRules`. Top-level shape is identical;
 * dataset-level upgrade is performed in `DataModelBuilder.migrate`.
 */
export type BlockDataV20260428 = BlockDataV20260427;

/** A CSV/TSV file whose header the prerun reads, with the separator and compression its name implies. */
export type XsvFileToPreprocess = {
  file: ImportFileHandle;
  xsvType: "csv" | "tsv";
  gzipped: boolean;
};

/** V20261116 adds the queue of CSV/TSV files whose header the prerun reads (Multisample CSV/TSV). */
export type BlockDataV20261116 = BlockDataV20260428 & {
  xsvFilesToPreprocess: XsvFileToPreprocess[];
};

export type BlockData = BlockDataV20261116;

export type BlockArgs = Pick<
  BlockData,
  "datasets" | "metadata" | "sampleLabelColumnLabel" | "sampleLabels"
>;

export type BlockPrerunArgs = Pick<
  BlockData,
  | "datasets"
  | "h5adFilesToPreprocess"
  | "seuratFilesToPreprocess"
  | "xsvFilesToPreprocess"
  | "metadataUploadHandle"
>;
