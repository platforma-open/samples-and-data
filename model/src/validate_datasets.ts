import type { ArgsIssue } from "@platforma-sdk/model";
import { isGroupedDataset } from "./args";
import type { DSAny } from "./args";

/**
 * Lists the dataset states the block must not run with, each as an error that
 * keeps Run disabled.
 *
 * A dataset with no data is a legal editor state (it is what a project
 * template seeds), but running it would export empty columns, so it blocks
 * Run until files are added. A block with no datasets at all still runs.
 */
export function validateDatasets(datasets: DSAny[]): ArgsIssue[] {
  const empty = datasets.filter((ds) => Object.keys(ds.content.data).length === 0);
  if (empty.length > 0) {
    return [
      {
        severity: "error",
        message: `No data in dataset${empty.length > 1 ? "s" : ""}: ${empty.map((ds) => `"${ds.label}"`).join(", ")}`,
      },
    ];
  }

  const valid = datasets.every((ds) => {
    if (!isGroupedDataset(ds)) return true;
    return (
      Object.keys(ds.content.sampleGroups ?? {}).length === Object.keys(ds.content.data).length
    );
  });
  if (!valid) {
    return [
      { severity: "error", message: "Not all grouped datasets have sample groups configured" },
    ];
  }

  return [];
}
