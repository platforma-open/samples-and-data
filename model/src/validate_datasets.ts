import { isGroupedDataset } from "./args";
import type { DSAny } from "./args";

/**
 * Rejects dataset states the block must not run with. Called from the model's
 * `args` derivation, so a throw here keeps Run disabled.
 *
 * A dataset with no data is a legal editor state (it is what a project
 * template seeds), but running it would export empty columns, so it blocks
 * Run until files are added. A block with no datasets at all still runs.
 */
export function validateDatasets(datasets: DSAny[]) {
  const empty = datasets.filter((ds) => Object.keys(ds.content.data).length === 0);
  if (empty.length > 0) {
    throw new Error(
      `No data in dataset${empty.length > 1 ? "s" : ""}: ${empty.map((ds) => `"${ds.label}"`).join(", ")}`,
    );
  }

  const valid = datasets.every((ds) => {
    if (!isGroupedDataset(ds)) return true;
    return (
      Object.keys(ds.content.sampleGroups ?? {}).length === Object.keys(ds.content.data).length
    );
  });
  if (!valid) throw new Error("Not all grouped datasets have sample groups configured");
}
