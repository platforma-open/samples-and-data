import type { Design, Material } from "./types";

/** A named example design. */
export type DesignFixture = { id: string; name: string; design: Design };

const sequenced = (id: string, meta: Material["meta"], from?: Material["from"]): Material => ({
  id,
  sequenced: true,
  meta,
  ...(from !== undefined && { from }),
});

const unsequenced = (id: string, from?: Material["from"]): Material => ({
  id,
  sequenced: false,
  meta: {},
  ...(from !== undefined && { from }),
});

const forkAndMerge: Design = {
  materials: [
    unsequenced("LIB"),
    sequenced("R1", { round: 1 }, { of: "LIB", part: "slice", split: "pan-1", step: "round" }),
    sequenced(
      "dep",
      { round: 2, sort: "depletion" },
      { of: "R1", part: "slice", split: "sort-2", step: "round" },
    ),
    sequenced(
      "str",
      { round: 2, sort: "stringent" },
      { of: "R1", part: "slice", split: "sort-2", step: "round" },
    ),
    sequenced(
      "R3",
      { round: 3 },
      { of: ["dep", "str"], part: "slice", split: "pan-3", step: "round" },
    ),
  ],
};

const arm = (name: string, target: string) =>
  [1, 2, 3].map((round) =>
    sequenced(
      `${name}_R${round}`,
      { round, target },
      {
        of: round === 1 ? "LIB" : `${name}_R${round - 1}`,
        part: "slice",
        split: `pan-${name}-${round}`,
        step: "round",
      },
    ),
  );

const bin = (name: string) =>
  sequenced(
    `X_${name}`,
    { round: 4, target: "T1", bin: name },
    { of: "X_R3", part: "slice", split: "sort-4" },
  );

const twoArmsOneSort: Design = {
  materials: [
    sequenced("LIB", { round: 0 }),
    ...arm("X", "T1"),
    ...arm("Y", "T2"),
    bin("low"),
    bin("mid"),
    bin("high"),
  ],
};

const titration = (index: number, conc: number) =>
  ["lo", "mid", "hi"].map((bin) =>
    sequenced(
      `t${index}_${bin}`,
      { stage: 2, conc_nM: conc, bin },
      { of: "COMBO", part: "slice", split: `titrate-${index}` },
    ),
  );

const scanThenCombine: Design = {
  materials: [
    unsequenced("SCAN"),
    sequenced("S1_IN", { stage: 1, condition: "input" }, { of: "SCAN", part: "whole" }),
    sequenced(
      "S1_OUT",
      { stage: 1, condition: "selected" },
      { of: "S1_IN", part: "slice", split: "select" },
    ),
    unsequenced("COMBO", { of: "S1_OUT", part: "remade" }),
    ...titration(1, 1),
    ...titration(2, 10),
    ...titration(3, 100),
  ],
};

const roundStep = (id: string, round: number, parent: string, split: string) =>
  sequenced(id, { round }, { of: parent, part: "slice", split, step: "round" });

const skippedRounds: Design = {
  materials: [
    unsequenced("LIB"),
    roundStep("P_R1", 1, "LIB", "pan-P"),
    roundStep("P_R2", 2, "P_R1", "pan"),
    roundStep("P_R3", 3, "P_R2", "pan"),
    roundStep("P_R5", 5, "P_R3", "pan"),
    roundStep("Q_R1", 1, "LIB", "pan-Q"),
    roundStep("Q_R3", 3, "Q_R1", "pan"),
    roundStep("S_R2", 2, "LIB", "pan-S"),
  ],
};

/** Example designs: fork-and-merge follows a synthetic study, the rest are invented. */
export const designFixtures: DesignFixture[] = [
  { id: "fork-and-merge", name: "Fork and merge", design: forkAndMerge },
  { id: "skipped-rounds", name: "Skipped rounds", design: skippedRounds },
  { id: "two-arms-one-sort", name: "Two arms, one sort", design: twoArmsOneSort },
  { id: "scan-then-combine", name: "Scan, then combine", design: scanThenCombine },
];

/** The design of the fixture with the given id. */
export const fixture = (id: string) => designFixtures.find((item) => item.id === id)!.design;
