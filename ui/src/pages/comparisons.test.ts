import { expect, test } from "vitest";
import { comparisonSections } from "./comparisons";

const row = (id: string, names: string[], constant: string[]) => ({
  id,
  type: "trajectory" as const,
  by: "Round",
  groups: names.map((name) => ({ name, samples: [] })),
  constant,
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
