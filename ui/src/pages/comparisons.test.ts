import { expect, test } from "vitest";
import { comparisonSections } from "./comparisons";

const row = (
  id: string,
  names: string[],
  constant: string[],
  varies: string[] = [],
  endpoint: string[] = [],
  arms: string[] = [],
) => ({
  id,
  type: "trajectory" as const,
  by: "Round",
  groups: names.map((name) => ({ name, samples: [] })),
  constant,
  varies,
  endpoint,
  arms,
  armKeys: arms,
  members: [],
});

test("same-shaped comparisons collapse into one section, named by the columns that differ", () => {
  const sections = comparisonSections([
    row("trajectory-1", ["R1", "R2"], ["Antigen = A", "Donor = 1", "Chain = H"]),
    row("trajectory-2", ["R1", "R2"], ["Antigen = B", "Donor = 1", "Chain = H"]),
    row("trajectory-3", ["R1", "R2"], ["Antigen = B", "Donor = 2", "Chain = H"]),
    row("trajectory-4", ["R1"], ["Antigen = A", "Donor = 2", "Chain = H"]),
  ]);
  expect(sections).toHaveLength(2);
  expect(sections[0].factors).toEqual(["Antigen", "Donor"]);
  expect(sections[0].shared).toEqual(["Chain = H"]);
  expect(sections[0].rows.map((r) => r.factorValues)).toEqual(["A · 1", "B · 1", "B · 2"]);
  expect(sections[1].rows).toHaveLength(1);
});

test("columns that vary inside look-alike comparisons tell them apart; agreed ones stay hidden", () => {
  const sections = comparisonSections([
    row("trajectory-1", ["R1", "R2"], ["Chain = H"], ["Gate = low", "Antigen = A"]),
    row("trajectory-2", ["R1", "R2"], ["Chain = H"], ["Gate = med", "Antigen = A"]),
  ]);
  expect(sections).toHaveLength(1);
  expect(sections[0].factors).toEqual(["Gate"]);
  expect(sections[0].shared).toEqual(["Chain = H"]);
  expect(sections[0].rows.map((r) => r.factorValues)).toEqual(["low", "med"]);
});

test("where a comparison ends tells it apart, and beats the values it passed through", () => {
  const sections = comparisonSections([
    row(
      "trajectory-1",
      ["R1", "R4"],
      ["Chain = H"],
      ["Elution = strip · basic"],
      ["Elution = basic"],
    ),
    row(
      "trajectory-2",
      ["R1", "R4"],
      ["Chain = H"],
      ["Elution = strip · acid"],
      ["Elution = acid"],
    ),
  ]);
  expect(sections[0]!.factors).toEqual(["Elution"]);
  expect(sections[0]!.rows.map((r) => r.factorValues)).toEqual(["basic", "acid"]);
});

test("a lone comparison shows no factors, however much varies inside it", () => {
  const [section] = comparisonSections([
    row("trajectory-1", ["R1"], ["Chain = H"], ["Gate = high", "Round = R1 · R2 · R3"]),
  ]);
  expect(section!.factors).toEqual([]);
  expect(section!.rows[0]!.factorValues).toBe("");
});

test("two panel arms stay two lines; the pieces of one arm collapse into it", () => {
  const sections = comparisonSections([
    row("trajectory-1", ["R1", "R3"], [], [], ["Gate = low"], ["FP8v1"]),
    row("trajectory-2", ["R1", "R3"], [], [], ["Gate = high"], ["FP8v1"]),
    row("trajectory-3", ["R1", "R3"], [], [], ["Gate = low"], ["FP8v2"]),
    row("trajectory-4", ["R1", "R3"], [], [], ["Gate = high"], ["FP8v2"]),
  ]);
  expect(sections.map((s) => s.arms)).toEqual([["FP8v1"], ["FP8v2"]]);
  expect(sections.map((s) => s.rows.length)).toEqual([2, 2]);
  expect(sections[0]!.factors).toEqual(["Gate"]);
  expect(sections[0]!.rows.map((r) => r.factorValues)).toEqual(["low", "high"]);
});
