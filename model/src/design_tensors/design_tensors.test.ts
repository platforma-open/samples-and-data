import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { ExperimentDesign } from "../args";
import { derive, type Material } from "./derive";
import {
  datasetSampleIds,
  deriveDesign,
  designObjects,
  designTensorRows,
  oneAxis,
  type DesignSource,
} from "./index";
import { endLabel, label, labelTensors, type Table } from "./labels";
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
    // ids come from the materials now, so find the panels by type and keep derivation order
    const panelIds = Object.entries(derived.json)
      .filter(([, t]) => t.type === "panel")
      .map(([id]) => id);
    derived.labelled.panels.forEach((panel, i) => {
      const json = derived.json[panelIds[i]!]!;
      if (json.type !== "panel") throw new Error("not a panel");
      const label = json.label;
      const splits = Object.keys(panel.panel.arms);
      json.arms.forEach((arm, k) =>
        label.axes.forEach((axis) => {
          // the published label keeps one of the axes STEP 3 found, so match it by its columns
          const raw = panel.label.axes.find(
            (c) => c.cols.join("\u0000") === axis.cols.join("\u0000"),
          );
          expect(axis.values[k]).toEqual(raw!.values[splits.indexOf(arm.split)]);
        }),
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

    // the published object holds every tensor, filed by type, and a label under the same id
    const [object] = designObjects([design], source);
    const data = object!.data;
    const filed = [
      ...Object.keys(data.trajectories),
      ...Object.keys(data.partitions),
      ...Object.keys(data.panels),
      ...(data.recurrence ? ["recurrence"] : []),
    ];
    expect(filed.sort()).toEqual(
      Object.keys(derived.json)
        .map((id) => (derived.json[id]!.type === "recurrence" ? "recurrence" : id))
        .sort(),
    );
    for (const id of Object.keys(data.trajectories))
      expect(data.labels.trajectories[id]).toBeDefined();
    for (const id of Object.keys(data.panels)) expect(data.labels.panels[id]).toBeDefined();
    // a panel's anchor is the material id, not its name: names live in `labels`
    for (const panel of Object.values(data.panels))
      expect(data.labels.materials[panel.anchor.material] ?? panel.anchor.material).toBeTruthy();
    // every sample the design names is listed once, sorted
    expect(object!.samples).toEqual([...new Set(object!.samples)].sort());
  });
});

describe("the published axis", () => {
  const axis = (cols: string[], values: string[][]) => ({ cols, values });

  test("keeps the set of columns with the fewest blanks", () => {
    const picked = oneAxis({
      axes: [
        axis(
          ["population", "condition"],
          [
            ["presort", ""],
            ["sort", "R1"],
          ],
        ),
        axis(["ladder"], [["0-display"], ["1-R1"]]),
      ],
      mixed: [],
      within: [],
      constant: [],
      end: [],
    });
    expect(picked.axes.map((a) => a.cols)).toEqual([["ladder"]]);
  });

  test("keeps the earlier set on a tie, and a lone axis untouched", () => {
    const tie = [axis(["a"], [[""], ["x"]]), axis(["b"], [[""], ["y"]])];
    const label = { axes: tie, mixed: [], within: [], constant: [], end: [] };
    expect(oneAxis(label).axes.map((a) => a.cols)).toEqual([["a"]]);
    expect(oneAxis({ ...label, axes: [tie[1]!] }).axes).toEqual([tie[1]]);
  });
});

describe("an axis the table mostly leaves blank", () => {
  // vfp1602's ladder column: four samples of its table carry a value, exactly one gate's lineage
  const table: Table = new Map([
    ["presort", { population: "presort", round: "", ladder: "" }],
    ["display", { population: "display-positive", round: "", ladder: "0-display" }],
    ["r1", { population: "antigen-sort", round: "R1", ladder: "1-R1" }],
    ["r2", { population: "antigen-sort", round: "R2", ladder: "2-R2" }],
    ["r3", { population: "antigen-sort", round: "R3", ladder: "3-R3" }],
    ["r1-low", { population: "antigen-sort", round: "R1", ladder: "" }],
    ["r2-low", { population: "antigen-sort", round: "R2", ladder: "" }],
    ["r3-low", { population: "antigen-sort", round: "R3", ladder: "" }],
    ["r1-med", { population: "antigen-sort", round: "R1", ladder: "" }],
    ["r2-med", { population: "antigen-sort", round: "R2", ladder: "" }],
    ["r3-med", { population: "antigen-sort", round: "R3", ladder: "" }],
  ]);
  const groups = [["presort"], ["display"], ["r1"], ["r2"], ["r3"]];

  test("loses to the columns the whole design shares", () => {
    // the ladder alone names every position, which is why it used to win on being one column
    expect(label(groups, table).axes.map((axis) => axis.cols)).toEqual([["population", "round"]]);
  });

  test("still names positions where nothing denser can", () => {
    const only: Table = new Map(
      [...table].slice(0, 5).map(([id, row]) => [id, { ladder: row.ladder! }]),
    );
    expect(label(groups, only).axes.map((axis) => axis.cols)).toEqual([["ladder"]]);
  });
});

describe("a trajectory named by where it ends", () => {
  // three replicates pooled into one input, then panned on their own
  const table: Table = new Map([
    ["in1", { replicate: "1", round: "0", antigen: "" }],
    ["in2", { replicate: "2", round: "0", antigen: "" }],
    ["mid", { replicate: "1", round: "1", antigen: "RBD" }],
    ["out", { replicate: "1", round: "4", antigen: "RBD" }],
  ]);
  const groups = [["in1", "in2"], ["mid"], ["out"]];
  const labelled = label(groups, table);

  test("reads the column the pooled start hides", () => {
    expect(labelled.within).toContain("replicate");
    expect(endLabel(groups, table, labelled)).toEqual([
      ["replicate", "1"],
      ["antigen", "RBD"],
    ]);
  });

  test("leaves out what the axis and the constants already name", () => {
    expect(labelled.axes.map((axis) => axis.cols)).toEqual([["round"]]);
    expect(endLabel(groups, table, labelled).map(([column]) => column)).not.toContain("round");
  });

  test("only trajectories get one", () => {
    const study = studies.find((s) => s.slug === "synthetic-03-bins-by-concentration")!;
    const { design, source } = asBlock(study);
    const derived = deriveDesign(design, 0, source);
    for (const tensor of Object.values(derived.json))
      if (tensor.type !== "trajectory") expect(tensor.label.end).toEqual([]);
  });
});

test("a trajectory carries the panel arm it runs through", () => {
  const study = studies.find((s) => s.slug === "synthetic-02-two-targets-one-control")!;
  const { design, source } = asBlock(study);
  const rows = designTensorRows(deriveDesign(design, 0, source), source.sampleLabels);
  expect(rows.filter((row) => row.type === "trajectory").map((row) => row.arms)).toEqual([
    ["A"],
    ["B"],
  ]);
  expect(rows.find((row) => row.type === "panel")!.arms).toEqual([]);
});

describe("a design limited to some datasets", () => {
  const { design, source } = asBlock(studies.find((s) => s.slug === "synthetic-01-panning-chain")!);
  const dataset = (id: string, samples: string[]) =>
    ({
      id,
      label: id,
      content: { type: "Xsv", data: Object.fromEntries(samples.map((s) => [s, null])) },
    }) as unknown as DesignSource["datasets"][number];
  const grouped = {
    id: "grouped",
    label: "grouped",
    content: { type: "MultiSampleXsv", data: { g: null }, sampleGroups: { g: { R2: "r2" } } },
  } as unknown as DesignSource["datasets"][number];
  const withData = {
    ...source,
    datasets: [dataset("all", ["R1", "R2", "R3"]), dataset("ends", ["R1", "R3"]), grouped],
  };
  const trajectory = (d: ExperimentDesign) => {
    const t = Object.values(deriveDesign(d, 0, withData).json).find(
      (x) => x.type === "trajectory",
    )!;
    if (t.type !== "trajectory") throw new Error("not a trajectory");
    return { positions: t.positions, datasets: t.datasets };
  };

  test("treats samples outside its datasets as not sequenced", () => {
    expect(
      trajectory({ ...design, datasetIds: ["ends"] as ExperimentDesign["datasetIds"] }),
    ).toEqual({
      positions: [["R1"], ["R3"]],
      datasets: ["ends"],
    });
  });

  test("applies to every dataset when it picks none, or only deleted ones", () => {
    const all = { positions: [["R1"], ["R2"], ["R3"]], datasets: ["all", "ends", "grouped"] };
    expect(trajectory(design)).toEqual(all);
    expect(
      trajectory({ ...design, datasetIds: ["gone"] as ExperimentDesign["datasetIds"] }),
    ).toEqual(all);
  });

  test("reads a grouped dataset's samples from its sample groups", () => {
    expect(datasetSampleIds(grouped)).toEqual(["R2"]);
  });
});

describe("naming a panel's arms", () => {
  // Two arms off one library. `round` tells their first positions apart but goes on changing
  // inside each arm; `path` holds still along each. This is the alpaca shape, where the arms came
  // out called R1 and R2, which are rounds rather than what the arms are.
  const tensors = {
    trajectories: [
      [["LIB"], ["T_R1"], ["T_R2"]],
      [["LIB"], ["C_R2"]],
    ],
    partitions: [],
    panels: [{ anchor: "LIB", reads: ["LIB"], arms: { "arm-t": [["T_R1"]], "arm-c": [["C_R2"]] } }],
    recurrences: [],
  };
  const table = new Map(
    Object.entries({
      LIB: { round: "Library", path: "Target" },
      T_R1: { round: "R1", path: "Target" },
      T_R2: { round: "R2", path: "Target" },
      C_R2: { round: "R2", path: "Control" },
    }),
  );

  test("prefers a column that holds still along the arm", () => {
    const [panel] = labelTensors(tensors, table).panels;
    expect(panel!.label.axes.map((a) => a.cols)).toEqual([["path"]]);
    expect(panel!.label.axes[0]!.values).toEqual([["Target"], ["Control"]]);
    // the round changes inside the target arm, so it names nothing here
    expect(panel!.label.within).toContain("round");
  });

  test("falls back to the first positions when no column holds still", () => {
    // drop `path`, leaving only the column that varies inside the arm
    const rounds = new Map([...table].map(([id, row]) => [id, { round: row.round }]));
    const [panel] = labelTensors(tensors, rounds).panels;
    expect(panel!.label.axes.map((a) => a.cols)).toEqual([["round"]]);
    expect(panel!.label.axes[0]!.values).toEqual([["R1"], ["R2"]]);
  });
});
