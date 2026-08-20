import type { BlockParams } from "@platforma-open/milaboratories.samples-and-data.kind";
import type { ImportFileHandle } from "@platforma-sdk/model";
import { assertNever, isImportFileHandleIndex } from "@platforma-sdk/model";
import { isGroupedDataset } from "./args";
import type { BlockData, DSAny, DSContent, MTColumn } from "./args";

/**
 * Derives the params a project exported as a template hands the block it seeds —
 * the inverse of the data model's `init`.
 *
 * Either the whole study travels or none of its data does. The block's state is
 * one connected thing — datasets key their files by sample or by group, sample
 * groups and multiplexing rules name those samples, metadata values are keyed by
 * them, and `args` holds the pieces to each other — so carrying part of it means
 * choosing which invariants to break. When every file can be resolved from where
 * the block lands, the state goes as it stands; when any file is local to this
 * machine, only the study's setup goes and the new project imports its own data.
 */
export function deriveTemplateParams(data: BlockData): BlockParams {
  if (data.datasets.every(isDatasetPortable)) {
    return {
      datasets: data.datasets,
      metadata: data.metadata,
      sampleIds: data.sampleIds,
      sampleLabelColumnLabel: data.sampleLabelColumnLabel,
      sampleLabels: data.sampleLabels,
      h5adFilesToPreprocess: data.h5adFilesToPreprocess,
      seuratFilesToPreprocess: data.seuratFilesToPreprocess,
    };
  }

  return {
    datasets: data.datasets.map(stripDatasetData),
    metadata: data.metadata.map(stripColumnValues),
    sampleLabelColumnLabel: data.sampleLabelColumnLabel,
  };
}

// Internals

/**
 * Tells whether a dataset holds no file that is bound to this machine.
 *
 * A storage reference (`index://`) names a `{storageId, path}` any installation
 * carrying that storage can resolve; an upload handle carries a local path
 * signed with the installation's own secret and resolves nowhere else. A slot
 * with no file yet is neither, so it does not stand in the way.
 */
function isDatasetPortable(ds: DSAny): boolean {
  return collectDatasetHandles(ds.content).every((h) => h == null || isImportFileHandleIndex(h));
}

/**
 * Collects every file slot a dataset holds, empty ones included.
 *
 * Exhaustive over the dataset kinds: a kind added to `DSContent` and not handled
 * here fails to compile on `assertNever`, rather than silently reporting that
 * the new kind holds no files — which would make it look portable and send its
 * local uploads into a template.
 */
function collectDatasetHandles(content: DSContent): (ImportFileHandle | null | undefined)[] {
  switch (content.type) {
    case "Fastq":
    case "MultiplexedFastq":
    case "CellRangerMTX":
      return Object.values(content.data).flatMap((group) => Object.values(group));
    case "MultilaneFastq":
      return Object.values(content.data).flatMap((lanes) =>
        Object.values(lanes).flatMap((group) => Object.values(group)),
      );
    case "TaggedFastq":
      return Object.values(content.data).flatMap((records) =>
        records.flatMap((record) => Object.values(record.files)),
      );
    case "TaggedXsv":
      return Object.values(content.data).flatMap((records) => records.map((record) => record.file));
    case "Fasta":
    case "Xsv":
    case "H5AD":
    case "H5":
    case "Seurat":
    case "BulkCountMatrix":
    case "MultiSampleH5AD":
    case "MultiSampleSeurat":
      return Object.values(content.data);
    default:
      return assertNever(content);
  }
}

/**
 * Strips everything a dataset holds per sample or per group, keeping how the
 * dataset is configured: its type, read indices, tag names, barcode tags, xsv
 * flavour, sample column name.
 */
function stripDatasetData(ds: DSAny): DSAny {
  const grouped = isGroupedDataset(ds);
  return {
    ...ds,
    // Cleared by name, not per dataset kind: the group fields exist only on
    // grouped datasets and the rules only on multiplexed ones, so they are
    // spread in conditionally and the union is restored by the one cast.
    content: {
      ...ds.content,
      data: {},
      ...(grouped ? { sampleGroups: undefined, groupLabels: {} } : {}),
      ...(ds.content.type === "MultiplexedFastq" ? { barcodeRules: [] } : {}),
    } as DSContent,
  };
}

/** Strips a metadata column's values, which are keyed by sample. */
function stripColumnValues(column: MTColumn): MTColumn {
  return { ...column, data: {} };
}
