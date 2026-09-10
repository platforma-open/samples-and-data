import type { MTColumn, PlId } from "@platforma-open/milaboratories.samples-and-data.model";
import { describe, expect, test } from "vitest";
import type { ImportResult } from "../dataimport";
import {
  defaultColumnMapping,
  isColumnTypeCompatible,
  type MetadataColumnMapping,
  populateMetadataFromRow,
  processMetadataColumns,
  resolveMetadataColumns,
  TARGET_IGNORE,
  TARGET_NEW,
  unfilledExistingColumns,
} from "./metadata";

const S1 = "s1" as PlId;

function column(id: string, label: string, valueType: MTColumn["valueType"] = "String"): MTColumn {
  return { id: id as PlId, label, valueType, global: true, data: {} };
}

function fill(columnId: string) {
  return { type: "existing" as const, columnId };
}

function candidate(columns: ImportResult["data"]["columns"], rows: unknown[][] = []): ImportResult {
  return {
    data: { columns, rows: rows as ImportResult["data"]["rows"] },
    missingHeaders: 0,
    emptyRowsRemoved: 0,
    malformedRowsRemoved: 0,
    emptyColumns: 0,
  };
}

describe("isColumnTypeCompatible", () => {
  test("String takes anything, Double takes numbers, Long takes only Long", () => {
    expect(isColumnTypeCompatible("String", "Long")).toBe(true);
    expect(isColumnTypeCompatible("String", "Double")).toBe(true);
    expect(isColumnTypeCompatible("Double", "Long")).toBe(true);
    expect(isColumnTypeCompatible("Double", "String")).toBe(false);
    expect(isColumnTypeCompatible("Long", "Long")).toBe(true);
    expect(isColumnTypeCompatible("Long", "Double")).toBe(false);
  });
});

describe("defaultColumnMapping", () => {
  const existing = [column("a", "Tissue"), column("b", "Age", "Long"), column("c", "Batch")];
  const ic = candidate([
    { header: "sample", type: "String" },
    { header: " tissue ", type: "String" },
    { header: "Age", type: "String" },
  ]);

  test("fills same-named compatible columns, adds the rest as new, ignores the sample column", () => {
    expect(defaultColumnMapping(existing, ic, [0])).toStrictEqual({
      0: TARGET_IGNORE,
      1: fill("a"),
      // "Age" in the file is a String while the project column is Long
      2: TARGET_NEW,
    });
  });

  test("one existing column is claimed by at most one file column", () => {
    const twice = candidate([
      { header: "Tissue", type: "String" },
      { header: "tissue", type: "String" },
    ]);
    expect(defaultColumnMapping(existing, twice, [])).toStrictEqual({
      0: fill("a"),
      1: TARGET_NEW,
    });
  });

  test("unfilledExistingColumns lists what the file leaves untouched", () => {
    const mapping = defaultColumnMapping(existing, ic, [0]);
    expect(unfilledExistingColumns(existing, mapping).map((c) => c.label)).toStrictEqual([
      "Age",
      "Batch",
    ]);
  });
});

describe("resolveMetadataColumns", () => {
  const existing = [column("a", "Tissue"), column("b", "Batch")];
  const ic = candidate([
    { header: "sample", type: "String" },
    { header: "organ", type: "String" },
    { header: "lot", type: "String" },
    { header: "extra", type: "Long" },
  ]);

  test("a file column fills the existing column it was pointed at, or becomes a new one", () => {
    const mapping: MetadataColumnMapping = { 1: fill("a"), 2: TARGET_NEW, 3: fill("b") };
    const { modelColumns, newColumns } = resolveMetadataColumns({
      importCandidate: ic,
      existingMetadata: existing,
      skipColumnIndices: [0],
      mapping,
    });
    expect(modelColumns[0]).toBeUndefined();
    expect(modelColumns[1]).toBe(existing[0]);
    expect(modelColumns[3]).toBe(existing[1]);
    expect(newColumns).toHaveLength(1);
    expect(newColumns[0]).toMatchObject({ label: "lot", valueType: "String" });
    expect(modelColumns[2]).toBe(newColumns[0]);
  });

  test("ignored columns produce nothing, and the sample column is ignored whatever the mapping says", () => {
    const mapping: MetadataColumnMapping = {
      0: fill("a"),
      1: TARGET_IGNORE,
      2: TARGET_IGNORE,
      3: TARGET_IGNORE,
    };
    const { modelColumns, newColumns } = resolveMetadataColumns({
      importCandidate: ic,
      existingMetadata: existing,
      skipColumnIndices: [0],
      mapping,
    });
    expect(modelColumns).toStrictEqual([undefined, undefined, undefined, undefined]);
    expect(newColumns).toHaveLength(0);
  });

  test("a target column that no longer exists falls back to a new column", () => {
    const { modelColumns, newColumns } = resolveMetadataColumns({
      importCandidate: ic,
      existingMetadata: existing,
      skipColumnIndices: [0],
      mapping: { 1: fill("gone"), 2: TARGET_IGNORE, 3: TARGET_IGNORE },
    });
    expect(newColumns.map((c) => c.label)).toStrictEqual(["organ"]);
    expect(modelColumns[1]).toBe(newColumns[0]);
  });

  test("two file columns may fill one existing column", () => {
    const { modelColumns } = resolveMetadataColumns({
      importCandidate: ic,
      existingMetadata: existing,
      skipColumnIndices: [0],
      mapping: { 1: fill("a"), 2: fill("a"), 3: TARGET_IGNORE },
    });
    expect(modelColumns[1]).toBe(existing[0]);
    expect(modelColumns[2]).toBe(existing[0]);
  });

  test("a new column never takes the name of a column already in the project", () => {
    const numeric = [column("a", "Age", "Long")];
    const withText = candidate([
      { header: "sample", type: "String" },
      // "N/A" among the numbers makes the file column a String, so it cannot
      // fill the project's Long column and has to be added instead.
      { header: "age", type: "String" },
    ]);
    const { newColumns } = resolveMetadataColumns({
      importCandidate: withText,
      existingMetadata: numeric,
      skipColumnIndices: [0],
      mapping: defaultColumnMapping(numeric, withText, [0]),
    });
    expect(newColumns.map((c) => c.label)).toStrictEqual(["age (2)"]);
  });

  test("two file columns whose names differ only in case or spacing do not collide", () => {
    const twice = candidate([
      { header: "Batch", type: "String" },
      { header: " batch ", type: "String" },
      { header: "BATCH", type: "String" },
    ]);
    const { newColumns } = resolveMetadataColumns({
      importCandidate: twice,
      existingMetadata: [],
      skipColumnIndices: [],
      mapping: {},
    });
    expect(newColumns.map((c) => c.label)).toStrictEqual(["Batch", "batch (2)", "BATCH (3)"]);
  });

  test("replace: with no existing columns every file column becomes a new one", () => {
    const { newColumns } = resolveMetadataColumns({
      importCandidate: ic,
      existingMetadata: [],
      skipColumnIndices: [0],
      mapping: {},
    });
    expect(newColumns.map((c) => c.label)).toStrictEqual(["organ", "lot", "extra"]);
  });
});

describe("processMetadataColumns", () => {
  test("keeps the name-based merge used by the samplesheet import", () => {
    const existing = [column("a", "Tissue")];
    const ic = candidate([
      { header: "sample", type: "String" },
      { header: "TISSUE", type: "String" },
      { header: "Batch", type: "String" },
    ]);
    const { modelColumns, newColumns } = processMetadataColumns({
      importCandidate: ic,
      existingMetadata: existing,
      skipColumnIndices: [0],
    });
    expect(modelColumns[1]).toBe(existing[0]);
    expect(newColumns.map((c) => c.label)).toStrictEqual(["Batch"]);
  });
});

describe("populateMetadataFromRow", () => {
  test("stringifies numbers for String columns and refuses strings for numeric ones", () => {
    const str = column("a", "A", "String");
    const num = column("b", "B", "Long");
    populateMetadataFromRow([undefined, 42, "oops"], S1, [undefined, str, num]);
    expect(str.data[S1]).toBe("42");
    expect(num.data[S1]).toBeUndefined();
    populateMetadataFromRow([undefined, "x", 7], S1, [undefined, str, num]);
    expect(str.data[S1]).toBe("x");
    expect(num.data[S1]).toBe(7);
  });
});
