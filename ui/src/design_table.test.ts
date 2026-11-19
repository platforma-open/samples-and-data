import type { PlId } from "@platforma-open/milaboratories.samples-and-data.model";
import { describe, expect, test } from "vitest";
import { editorDesign, removedSample, storedDesign, tableSamples } from "./design_table";

const first = "aaaaaaaaaaaaaaaaaaaaaaaa" as PlId;
const second = "bbbbbbbbbbbbbbbbbbbbbbbb" as PlId;
const table = {
  sampleIds: [first, second],
  sampleLabels: { [first]: "Sample 1", [second]: "" },
  metadata: [
    { id: "c1", label: "Round", global: false, valueType: "Long" as const, data: { [first]: 1 } },
    {
      id: "c2",
      label: "Arm",
      global: false,
      valueType: "String" as const,
      data: { [first]: "A", [second]: "B" },
    },
  ],
};
const stored = {
  materials: [
    { id: "shadow-1", sequenced: false, name: "Library" },
    {
      id: first,
      sequenced: true,
      from: { of: "shadow-1", part: "slice" as const, split: "split-1" },
    },
    { id: "gone", sequenced: true, from: { of: first, part: "whole" as const } },
  ],
};

describe("design table", () => {
  test("tableSamples makes column names unique and skips empty values", () => {
    const column = (id: string, label: string, value: string) => ({
      id,
      label,
      global: false,
      valueType: "String" as const,
      data: { [first]: value },
    });
    const samples = tableSamples({
      sampleIds: [first],
      sampleLabels: { [first]: "Sample 1" },
      metadata: [
        column("c1", "Arm", "A"),
        column("c2", "Arm", "B"),
        column("c3", " ", "C"),
        column("c4", "Gate", ""),
      ],
    });
    expect(samples[0].meta).toEqual({ Arm: "A", "Arm (2)": "B", "Unnamed column": "C" });
  });

  test("tableSamples keeps table order, labels and metadata by column label", () => {
    expect(tableSamples(table)).toEqual([
      { id: first, name: "Sample 1", meta: { Round: 1, Arm: "A" } },
      { id: second, name: "Unnamed sample", meta: { Arm: "B" } },
    ]);
  });

  test("editorDesign shows samples live from the table and flags a removed sample", () => {
    const design = editorDesign(stored, tableSamples(table));
    expect(design.materials).toEqual([
      { id: "shadow-1", sequenced: false, name: "Library", meta: {} },
      { ...stored.materials[1], name: "Sample 1", meta: { Round: 1, Arm: "A" } },
      { ...stored.materials[2], ...removedSample, meta: {} },
    ]);
    expect(editorDesign(undefined, [])).toEqual({ materials: [] });
  });

  test("storedDesign drops what comes from the table and round-trips", () => {
    const design = editorDesign(stored, tableSamples(table));
    expect(storedDesign(design)).toEqual(stored);
  });
});
