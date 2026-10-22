import { expect, test } from "vitest";
import type {
  BarcodeRule,
  BlockData,
  DSAny,
  DSMultiplexedFastq,
  ImportFileHandle,
  PlId,
} from "./args";
import { blockArgsIssues } from "./args_issues";

const sample = "SAMPLE0000000000000000000" as PlId;
const group = "GROUP00000000000000000000" as PlId;
const file = "index://storage/path" as ImportFileHandle;

function blockData(datasets: DSAny[]): BlockData {
  return {
    datasets,
    metadata: [],
    sampleIds: [sample],
    sampleLabelColumnLabel: "Sample",
    sampleLabels: { [sample]: "S1" },
    h5adFilesToPreprocess: [],
    seuratFilesToPreprocess: [],
    metadataUploadHandle: undefined,
    suggestedImport: false,
  };
}

function multiplexed(label: string, rules: BarcodeRule[]): DSMultiplexedFastq {
  return {
    id: `${label}-id` as PlId,
    label,
    content: {
      type: "MultiplexedFastq",
      gzipped: true,
      readIndices: ["R1"],
      data: { [group]: { R1: file } },
      sampleGroups: { [group]: { [sample]: "s1" } },
      groupLabels: { [group]: "g1" },
      barcodeTags: ["CELL"],
      barcodeRules: rules,
    },
  };
}

function rule(barcode: string): BarcodeRule {
  return { ruleId: "r1", sampleGroupId: group, sampleId: sample, barcodes: { CELL: barcode } };
}

test("a block with no datasets runs", () => {
  expect(blockArgsIssues(blockData([]))).toEqual([]);
});

test("configured multiplexing rules let the block run", () => {
  expect(blockArgsIssues(blockData([multiplexed("Mux", [rule("ACGT")])]))).toEqual([]);
});

test("dataset problems are reported without checking the rules", () => {
  const ds = multiplexed("Mux", [rule("")]);
  ds.content.data = {};
  expect(blockArgsIssues(blockData([ds]))).toEqual([
    { severity: "error", message: 'No data in dataset: "Mux"' },
  ]);
});

test("rule issues are joined into one error, warnings included", () => {
  const ds = multiplexed("Mux", [rule(""), { ...rule("x"), sampleGroupId: "OTHER" as PlId }]);
  expect(blockArgsIssues(blockData([ds]))).toEqual([
    {
      severity: "error",
      message:
        "Mux: 1 empty barcode value in the rules table. | Mux: 1 rule reference unknown file groups.",
    },
  ]);
});

test("a rule warning alone still blocks Run", () => {
  const ds = multiplexed("Mux", []);
  expect(blockArgsIssues(blockData([ds]))).toEqual([
    { severity: "error", message: "Mux: 1 file group without rules: g1." },
  ]);
});

test("the same barcodes for two samples of one group block Run", () => {
  const other = "SAMPLE0000000000000000001" as PlId;
  const ds = multiplexed("Mux", [rule("ACGT"), { ...rule("ACGT"), ruleId: "r2", sampleId: other }]);
  const data = { ...blockData([ds]), sampleLabels: { [sample]: "S1", [other]: "S2" } };
  expect(blockArgsIssues(data)).toEqual([
    {
      severity: "error",
      message: "Mux: Same barcodes assigned to different samples in the same group — g1: S1, S2.",
    },
  ]);
});
