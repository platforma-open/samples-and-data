import type { BlockParams } from "@platforma-open/milaboratories.samples-and-data.kind";
import { isGroupedDataset } from "./args";
import type { BlockData, DSAny, DSContent, MTColumn } from "./args";

/**
 * Derives the params a project exported as a template hands the block it seeds —
 * the inverse of the data model's `init`.
 *
 * The study's setup travels, its data does not: every dataset and every metadata
 * column goes as configured, emptied of everything keyed by sample or by group.
 * The block the template seeds is the study as it was set up, waiting for its
 * files — the user re-adds data into the datasets that were already there, in
 * place of rebuilding them.
 *
 * Data is dropped whether or not it could travel. A file is portable only when
 * it is a storage reference (`index://` names a `{storageId, path}` any
 * installation carrying that storage can resolve, while `upload://` carries a
 * local path signed with the installation's own secret), so carrying files
 * would make a template mean one thing for one study and another for the next.
 * Samples go with the files that produced them, so `sampleIds` and
 * `sampleLabels` stay behind too — a sample without its file is a row with
 * metadata and no data, for the user to delete.
 */
export function deriveTemplateParams(data: BlockData): BlockParams {
  return {
    datasets: data.datasets.map(stripDatasetData),
    metadata: data.metadata.map(stripColumnValues),
    sampleLabelColumnLabel: data.sampleLabelColumnLabel,
  };
}

// Internals

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
