import type { ArgsIssue } from "@platforma-sdk/model";
import type { BlockData } from "./args";
import { validateMultiplexingRules } from "./multiplexing-rules-validation";
import { validateDatasets } from "./validate_datasets";

/**
 * Lists what keeps the block from running. Dataset problems are checked first;
 * the multiplexing rules are checked only once the datasets themselves are
 * runnable, and every rule issue blocks Run, warnings included.
 */
export function blockArgsIssues(data: BlockData): ArgsIssue[] {
  const datasetIssues = validateDatasets(data.datasets);
  if (datasetIssues.length > 0) return datasetIssues;

  const ruleIssues = validateMultiplexingRules(data.datasets, data.sampleLabels);
  if (ruleIssues.length === 0) return [];
  return [
    {
      severity: "error",
      message: ruleIssues.map((i) => `${i.datasetLabel}: ${i.message}`).join(" | "),
    },
  ];
}
