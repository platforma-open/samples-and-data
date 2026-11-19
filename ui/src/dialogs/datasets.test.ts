import type { PlId } from "@platforma-sdk/model";
import { describe, expect, test } from "vitest";
import { assignMultiSampleXsvSamples, multiSampleXsvLabels } from "./datasets";

const g1 = "g1" as PlId;
const g2 = "g2" as PlId;
const g3 = "g3" as PlId;
const groupLabels = { [g1]: "plate1", [g2]: "plate2", [g3]: "plate3" } as Record<PlId, string>;

/** Block samples by label, as getOrCreateSample keeps them */
function sampleRegistry(existing: Record<string, string> = {}) {
  const byLabel = new Map(Object.entries(existing) as [string, PlId][]);
  const created: string[] = [];
  const getOrCreate = (label: string): PlId => {
    const found = byLabel.get(label);
    if (found) return found;
    const id = `s${byLabel.size + 1}` as PlId;
    byLabel.set(label, id);
    created.push(label);
    return id;
  };
  const labelOf = (id: PlId) => [...byLabel].find(([, v]) => v === id)?.[0];
  return { getOrCreate, created, labelOf };
}

describe("multiSampleXsvLabels", () => {
  test("a value in one file is its own label; a value in several files gets the file label", () => {
    expect(
      multiSampleXsvLabels({ [g1]: ["A01", "B05"], [g2]: ["A01", "C07"] }, groupLabels),
    ).toEqual({
      [g1]: { A01: "A01 (plate1)", B05: "B05" },
      [g2]: { A01: "A01 (plate2)", C07: "C07" },
    });
  });
});

describe("assignMultiSampleXsvSamples", () => {
  test("a value in several files gives one sample per file", () => {
    const reg = sampleRegistry();
    const result = assignMultiSampleXsvSamples(
      { [g1]: ["A01", "B05"], [g2]: ["A01"] },
      groupLabels,
      undefined,
      reg.getOrCreate,
    );

    expect(reg.created.sort()).toEqual(["A01 (plate1)", "A01 (plate2)", "B05"]);
    const g1Samples = Object.keys(result[g1]);
    const g2Samples = Object.keys(result[g2]);
    expect(g1Samples.filter((s) => g2Samples.includes(s))).toEqual([]);
    expect(Object.values(result[g1]).sort()).toEqual(["A01", "B05"]);
    expect(Object.values(result[g2])).toEqual(["A01"]);
  });

  test("a value in one file reuses a block sample with the same label", () => {
    const reg = sampleRegistry({ B05: "existing" });
    const result = assignMultiSampleXsvSamples(
      { [g1]: ["B05"] },
      groupLabels,
      undefined,
      reg.getOrCreate,
    );

    expect(result).toEqual({ [g1]: { existing: "B05" } });
    expect(reg.created).toEqual([]);
  });

  test("values already imported keep their sample when a file with the same value is added", () => {
    const reg = sampleRegistry({ A01: "sA" });
    const result = assignMultiSampleXsvSamples(
      { [g1]: ["A01"], [g3]: ["A01"] },
      groupLabels,
      { [g1]: { ["sA" as PlId]: "A01" } },
      reg.getOrCreate,
    );

    expect(result[g1]).toEqual({ sA: "A01" });
    const [g3Sample] = Object.keys(result[g3]) as PlId[];
    expect(reg.labelOf(g3Sample)).toBe("A01 (plate3)");
  });
});
