import type { ImportFileHandle } from "@platforma-sdk/model";
import type { DesignObject } from "./design_tensors";
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

/** How a design material was made: its parent or parents and the step that made it. */
export type DesignMaterialFrom = {
  of: string | string[];
  part: "whole" | "slice" | "remade";
  split?: string;
  step?: "round" | "timecourse";
};

/** One material of the experiment design. A sequenced one references a sample by its id; labels come from the metadata table. */
export type DesignMaterial = {
  id: string;
  sequenced: boolean;
  name?: string;
  from?: DesignMaterialFrom;
};

/** The design wizard's answer for one metadata column (the wizard's `ColumnB`). */
export type DesignWizardColumn = {
  role: string;
  baseline?: string[];
  step?: "round" | "timecourse" | "none";
  part?: "slice" | "whole";
  fillGaps?: boolean;
  spine?: boolean;
  carry?: string;
  remadeFrom?: "last" | "virtual";
  libraryBy?: string[];
};

/**
 * The design wizard's answers, kept so the wizard reopens where the user left it. Columns are a
 * list because their order matters (it breaks ties and sets nesting) and stored maps lose key order.
 */
export type DesignWizardAnswers = {
  columns: { column: string; answer: DesignWizardColumn }[];
  /** Value orders the user set for rounds and generations, by column. */
  orders: Record<string, string[]>;
};

/** One experiment design, drawn on its own page. An empty label shows a placeholder name. */
export type ExperimentDesign = {
  id: PlId;
  label: string;
  materials: DesignMaterial[];
  wizard?: DesignWizardAnswers;
  /** The datasets the design applies to; absent or empty means all of them. */
  datasetIds?: PlId[];
};

/** The placeholder name of the design at `index` in the list. */
export const designPlaceholder = (index: number) => `Design ${index + 1}`;

/** The name a design shows: its label, or its placeholder name. */
export function designLabel(design: Pick<ExperimentDesign, "label">, index: number) {
  if (design.label.trim() === "") {
    return designPlaceholder(index);
  }
  return design.label;
}

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

/** V20261116 adds the queue of CSV/TSV files whose header the prerun reads (Multisample CSV/TSV), and the optional `designs`. Designs reach the args only as their derived tensors. */
export type BlockDataV20261116 = BlockDataV20260428 & {
  xsvFilesToPreprocess: XsvFileToPreprocess[];
  designs?: ExperimentDesign[];
};

export type BlockData = BlockDataV20261116;

export type BlockArgs = Pick<
  BlockData,
  "datasets" | "metadata" | "sampleLabelColumnLabel" | "sampleLabels"
> & {
  /** One object per design, each exported into the result pool as `pl7.app/design`. */
  designObjects: DesignObject[];
};

export type BlockPrerunArgs = Pick<
  BlockData,
  | "datasets"
  | "h5adFilesToPreprocess"
  | "seuratFilesToPreprocess"
  | "xsvFilesToPreprocess"
  | "metadataUploadHandle"
>;
