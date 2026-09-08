import { expect, test } from "vitest";
import type { DSAny, DSFastq, DSBulkCountMatrix, ImportFileHandle, PlId } from "./args";
import { validateDatasets } from "./validate_datasets";

const sample = "SAMPLE0000000000000000000" as PlId;
const group = "GROUP00000000000000000000" as PlId;
const file = "index://storage/path" as ImportFileHandle;

function fastq(label: string, withData: boolean): DSFastq {
  return {
    id: `${label}-id` as PlId,
    label,
    content: {
      type: "Fastq",
      gzipped: true,
      readIndices: ["R1"],
      data: withData ? { [sample]: { R1: file } } : {},
    },
  };
}

function bulkCountMatrix(label: string, withData: boolean): DSBulkCountMatrix {
  return {
    id: `${label}-id` as PlId,
    label,
    content: {
      type: "BulkCountMatrix",
      gzipped: false,
      xsvType: "csv",
      data: withData ? { [group]: file } : {},
      sampleGroups: withData ? { [group]: { [sample]: "s1" } } : undefined,
      groupLabels: withData ? { [group]: "g1" } : {},
    },
  };
}

test("a block with no datasets runs", () => {
  expect(() => validateDatasets([])).not.toThrow();
});

test("datasets with data pass", () => {
  expect(() =>
    validateDatasets([fastq("Reads", true), bulkCountMatrix("Counts", true)]),
  ).not.toThrow();
});

test("a single empty dataset is rejected by label", () => {
  expect(() => validateDatasets([fastq("Reads", false)])).toThrow('No data in dataset: "Reads"');
});

test("an empty grouped dataset is rejected as empty, not as misconfigured", () => {
  expect(() => validateDatasets([bulkCountMatrix("Counts", false)])).toThrow(
    'No data in dataset: "Counts"',
  );
});

test("multiple empty datasets are all named", () => {
  expect(() => validateDatasets([fastq("Reads", false), bulkCountMatrix("Counts", false)])).toThrow(
    'No data in datasets: "Reads", "Counts"',
  );
});

test("mixed datasets name only the empty ones", () => {
  const datasets: DSAny[] = [
    fastq("Reads", true),
    fastq("More reads", false),
    bulkCountMatrix("Counts", true),
  ];
  expect(() => validateDatasets(datasets)).toThrow('No data in dataset: "More reads"');
});

test("a grouped dataset with data but no groups is still rejected", () => {
  const ds = bulkCountMatrix("Counts", true);
  ds.content.sampleGroups = undefined;
  expect(() => validateDatasets([ds])).toThrow(
    "Not all grouped datasets have sample groups configured",
  );
});
