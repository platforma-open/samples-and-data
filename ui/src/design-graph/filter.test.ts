import { describe, expect, test } from "vitest";
import type { SampleFilter } from "./filter";
import { filterOptions, matchesFilters } from "./filter";
import type { Sample } from "./types";

const samples: Sample[] = [
  { id: "A", meta: { target: "T1", round: 1 } },
  { id: "B", meta: { round: "1", target: "T2" } },
  { id: "C", meta: { round: 10, target: "T2" } },
  { id: "D", meta: { round: 2 } },
];
const matching = (filters: SampleFilter[]) =>
  samples.filter((sample) => matchesFilters(sample, filters)).map((sample) => sample.id);

describe("filter", () => {
  test("filterOptions merges equal values and sorts columns in table order, values naturally", () => {
    expect(filterOptions(samples).map((option) => option.label)).toEqual([
      "target: T1",
      "target: T2",
      "round: 1",
      "round: 2",
      "round: 10",
    ]);
  });

  test("matchesFilters keeps every sample without filters", () => {
    expect(matching([])).toEqual(["A", "B", "C", "D"]);
  });

  test("matchesFilters joins values of one column with OR and columns with AND", () => {
    expect(
      matching([
        { column: "round", cell: "1" },
        { column: "round", cell: "2" },
      ]),
    ).toEqual(["A", "B", "D"]);
    expect(
      matching([
        { column: "round", cell: "1" },
        { column: "target", cell: "T2" },
      ]),
    ).toEqual(["B"]);
  });

  test("matchesFilters leaves out a sample without the filtered column", () => {
    expect(matching([{ column: "target", cell: "T2" }])).toEqual(["B", "C"]);
    expect(matching([{ column: "target", cell: "undefined" }])).toEqual([]);
  });
});
