import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { ExperimentDesign } from "../args";
import { derive, type Material } from "./derive";
import { deriveDesign, designTensorCells, designTensorRows, type DesignSource } from "./index";
import { labelTensors } from "./labels";
import { renderLabels, renderText } from "./render";
import { inferTensors } from "./tensors";

// tensor_derivation's synthetic studies with the outputs its own tests expect
// (expected/ and expected-labels/). The copy here must give the same.
type Study = {
  slug: string;
  materials: Record<string, Material>;
  columns: string[];
  table: Record<string, Record<string, string>>;
  expected: string;
  expectedLabels: string;
};
const studies: Study[] = JSON.parse(
  readFileSync(join(import.meta.dirname, "synthetic-studies.json"), "utf8"),
);

/** A study as Samples & Data holds it: a design and the metadata columns. */
function asBlock(study: Study): { design: ExperimentDesign; source: DesignSource } {
  const sampleIds = Object.keys(study.table) as DesignSource["sampleIds"];
  return {
    design: {
      id: "D" as ExperimentDesign["id"],
      label: study.slug,
      materials: Object.entries(study.materials).map(([id, material]) => ({
        id,
        sequenced: id in study.table,
        ...(material.from && { from: material.from }),
      })) as ExperimentDesign["materials"],
    },
    source: {
      sampleIds,
      sampleLabels: Object.fromEntries(sampleIds.map((id) => [id, id])),
      metadata: study.columns.map((column) => ({
        id: column,
        label: column,
        global: false,
        valueType: "String" as const,
        data: Object.fromEntries(sampleIds.map((id) => [id, study.table[id]![column]!])),
      })),
      datasets: [],
    },
  };
}

describe.each(studies)("$slug", (study) => {
  const table = new Map(Object.entries(study.table));
  const tensors = inferTensors(derive(study.materials, new Set(table.keys())));

  test("derives the expected tensors", () => {
    expect(renderText(tensors).trimEnd()).toBe(study.expected.trimEnd());
  });

  test("labels them as expected", () => {
    expect(renderLabels(labelTensors(tensors, table)).trimEnd()).toBe(
      study.expectedLabels.trimEnd(),
    );
  });

  test("the block derives the same from its design and metadata", () => {
    const { design, source } = asBlock(study);
    const derived = deriveDesign(design, 0, source);
    expect(renderLabels(derived.labelled)).toBe(renderLabels(labelTensors(tensors, table)));

    // one label per tensor, aligned with the tensor's groups (a panel's arms are sorted by split)
    for (const tensor of Object.values(derived.json)) {
      const groups = tensor.type === "panel" ? tensor.arms.length : tensor.positions.length;
      for (const axis of tensor.label.axes) expect(axis.values).toHaveLength(groups);
    }
    derived.labelled.panels.forEach((panel, i) => {
      const json = derived.json[`panel-${i + 1}`]!;
      if (json.type !== "panel") throw new Error("not a panel");
      const label = json.label;
      const splits = Object.keys(panel.panel.arms);
      json.arms.forEach((arm, k) =>
        label.axes.forEach((axis, a) =>
          expect(axis.values[k]).toEqual(panel.label.axes[a]!.values[splits.indexOf(arm.split)]),
        ),
      );
    });

    // the viewer lists every tensor, one named group per position or arm
    const rows = designTensorRows(derived, source.sampleLabels);
    expect(rows.map((row) => row.id)).toEqual(Object.keys(derived.json));
    for (const row of rows) {
      const tensor = derived.json[row.id]!;
      expect(row.groups).toHaveLength(
        tensor.type === "panel" ? tensor.arms.length : tensor.positions.length,
      );
      for (const group of row.groups) expect(group.name).not.toBe("");
    }

    const cells = designTensorCells([design], source);
    expect(Object.keys(cells.tensors).sort()).toEqual(
      Object.keys(derived.json)
        .map((id) => JSON.stringify(["D", id]))
        .sort(),
    );
  });
});
