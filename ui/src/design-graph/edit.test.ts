import { describe, expect, test } from "vitest";
import {
  addMergedChildren,
  addPartition,
  addStart,
  addStartSamples,
  addStep,
  connect,
  deleteMaterial,
  insertStep,
  joinSplit,
  leaveSplit,
  makeSplit,
  mergeInto,
  moveUnder,
  removeNode,
  renameMaterial,
  replaceWithSample,
  setName,
  setPart,
  setPartOf,
  setStep,
  siblingsOf,
  splitLine,
} from "./edit";
import { fixture } from "./fixtures";
import { withJunctions } from "./junctions";
import { toGraph } from "./toGraph";

const forkAndMerge = fixture("fork-and-merge");
const from = (design: typeof forkAndMerge, id: string) =>
  design.materials.find((item) => item.id === id)!.from;

describe("edit", () => {
  test("setPart drops the split off a slice and gives a new slice its own split", () => {
    const whole = setPart(forkAndMerge, "dep", "whole");
    expect(from(whole, "dep")).toEqual({ of: "R1", part: "whole", step: "round" });
    const slice = setPart(whole, "dep", "slice");
    expect(from(slice, "dep")?.split).not.toBe("sort-2");
    expect(from(setPart(forkAndMerge, "dep", "slice"), "dep")?.split).toBe("sort-2");
  });

  test("setStep sets and clears the step type", () => {
    expect(from(setStep(forkAndMerge, "R1"), "R1")).toEqual({
      of: "LIB",
      part: "slice",
      split: "pan-1",
    });
    expect(from(setStep(forkAndMerge, "R1", "timecourse"), "R1")?.step).toBe("timecourse");
  });

  test("leaveSplit and joinSplit move a sibling out of and into a separation", () => {
    const apart = leaveSplit(forkAndMerge, "str");
    expect(from(apart, "str")?.split).not.toBe("sort-2");
    expect(from(joinSplit(apart, "dep", "str"), "str")?.split).toBe("sort-2");
  });

  test("siblingsOf ignores children of a pool", () => {
    expect(siblingsOf(forkAndMerge, "dep").map((item) => item.id)).toEqual(["str"]);
    expect(siblingsOf(forkAndMerge, "R3")).toEqual([]);
  });

  test("renameMaterial updates every reference", () => {
    const renamed = renameMaterial(forkAndMerge, "dep", "depleted");
    expect(from(renamed, "R3")?.of).toEqual(["depleted", "str"]);
    expect(renamed.materials.some((item) => item.id === "depleted")).toBe(true);
  });

  test("addStart adds a shadow root with a generated id", () => {
    const { design, id } = addStart(forkAndMerge);
    expect(design.materials.find((item) => item.id === id)).toEqual({
      id: "shadow-1",
      sequenced: false,
      meta: {},
    });
  });

  test("insertStep puts a shadow step between a material and its parents", () => {
    const { design, id } = insertStep(forkAndMerge, "R3")!;
    expect(from(design, id)).toEqual({
      of: ["dep", "str"],
      part: "slice",
      split: "pan-3",
      step: "round",
    });
    expect(from(design, "R3")).toEqual({ of: id, part: "whole" });
    expect(insertStep(forkAndMerge, "LIB")).toBeUndefined();
  });

  test("addStep adds a shadow made from all of its parent", () => {
    const { design, id } = addStep(forkAndMerge, "R3");
    expect(from(design, id)).toEqual({ of: "R3", part: "whole" });
  });

  test("mergeInto adds one shadow made from all the parents", () => {
    const { design, id } = mergeInto(forkAndMerge, ["R1", "R3"], "whole")!;
    expect(from(design, id)).toEqual({ of: ["R1", "R3"], part: "whole" });
    expect(mergeInto(forkAndMerge, ["R1"], "whole")).toBeUndefined();
  });

  test("makeSplit joins siblings into one split and refuses materials of different parents", () => {
    const apart = leaveSplit(forkAndMerge, "str");
    const joined = makeSplit(apart, ["dep", "str"])!;
    expect(from(joined, "str")?.split).toBe(from(joined, "dep")?.split);
    expect(makeSplit(forkAndMerge, ["dep", "R1"])).toBeUndefined();
    expect(makeSplit(forkAndMerge, ["dep", "str"])).toBeUndefined();
    const whole = setPart(forkAndMerge, "str", "whole");
    for (const order of [
      ["dep", "str"],
      ["str", "dep"],
    ]) {
      const result = makeSplit(whole, order)!;
      expect([from(result, "dep")?.split, from(result, "str")?.split]).toEqual([
        "sort-2",
        "sort-2",
      ]);
    }
  });

  test("moveUnder keeps partitions of one split together and refuses cycles", () => {
    const moved = moveUnder(forkAndMerge, ["dep", "str"], "LIB")!;
    expect(from(moved, "dep")).toMatchObject({ of: "LIB", part: "slice", step: "round" });
    expect(from(moved, "str")?.split).toBe(from(moved, "dep")?.split);
    expect(from(moved, "dep")?.split).not.toBe(from(moved, "R1")?.split);
    expect(moveUnder(forkAndMerge, ["R1"], "R3")).toBeUndefined();
    expect(moveUnder(forkAndMerge, ["R3"], "R1::split::sort-2")).toBeUndefined();
  });

  test("setPartOf sets the connection type of each material", () => {
    const wholes = setPartOf(forkAndMerge, ["dep", "str"], "whole");
    expect([from(wholes, "dep")?.part, from(wholes, "str")?.part]).toEqual(["whole", "whole"]);
  });

  test("addMergedChildren adds one step made from all the parents, with the samples as one split", () => {
    const samples = [
      { id: "S01", name: "S01", meta: {} },
      { id: "S02", name: "S02", meta: {} },
    ];
    const { design, id } = addMergedChildren(forkAndMerge, ["dep", "str"], samples, "slice")!;
    expect(from(design, id)).toEqual({ of: ["dep", "str"], part: "whole" });
    expect(from(design, "S01")).toEqual({ of: id, part: "slice", split: "split-1" });
    expect(from(design, "S02")).toEqual(from(design, "S01"));
    const wholes = addMergedChildren(forkAndMerge, ["dep", "str"], samples, "whole")!;
    expect(from(wholes.design, "S01")).toEqual({ of: wholes.id, part: "whole" });
    expect(
      addMergedChildren(
        forkAndMerge,
        ["dep", "str"],
        [{ id: "LIB", name: "LIB", meta: {} }],
        "whole",
      ),
    ).toBeUndefined();
    expect(addMergedChildren(forkAndMerge, ["dep"], samples, "whole")).toBeUndefined();
    expect(addMergedChildren(forkAndMerge, ["dep", "gone"], samples, "whole")).toBeUndefined();
  });

  test("setName sets and clears a shadow's name", () => {
    const named = setName(forkAndMerge, "LIB", "library");
    expect(named.materials[0].name).toBe("library");
    expect(setName(named, "LIB").materials[0]).not.toHaveProperty("name");
  });

  test("addPartition adds a sibling in the same separation", () => {
    const { design, id } = addPartition(forkAndMerge, "R1", "sort-2");
    expect(from(design, id)).toEqual({ of: "R1", part: "slice", split: "sort-2", step: "round" });
  });

  test("splitLine keeps the slice's split and adds a second partition", () => {
    const result = splitLine(forkAndMerge, "R1")!;
    expect(result.split).toBe("pan-1");
    expect(from(result.design, result.id)).toEqual({
      of: "LIB",
      part: "slice",
      split: "pan-1",
      step: "round",
    });
  });

  test("splitLine turns a whole step into a slice", () => {
    const result = splitLine(setPart(forkAndMerge, "R1", "whole"), "R1")!;
    expect(from(result.design, "R1")).toMatchObject({ part: "slice", split: result.split });
  });

  test("deleteMaterial gives the children its parents and keeps a split together", () => {
    const withoutR1 = deleteMaterial(forkAndMerge, "R1");
    expect(withoutR1.materials.some((item) => item.id === "R1")).toBe(false);
    expect(from(withoutR1, "dep")).toMatchObject({ of: "LIB", part: "slice", step: "round" });
    expect(from(withoutR1, "str")?.split).toBe(from(withoutR1, "dep")?.split);
    expect(from(deleteMaterial(forkAndMerge, "LIB"), "R1")).toBeUndefined();
    expect(from(deleteMaterial(forkAndMerge, "dep"), "R3")).toMatchObject({ of: ["R1", "str"] });
  });

  test("deleteMaterial drops a duplicate parent, keeps a whole step and dissolves a merge", () => {
    const stepped = addStep(forkAndMerge, "R1");
    const doubled = connect(stepped.design, "dep", stepped.id, "whole")!;
    expect(from(deleteMaterial(doubled, "dep"), stepped.id)).toEqual({ of: "R1", part: "whole" });
    expect(from(deleteMaterial(stepped.design, "R1"), stepped.id)).toEqual({
      of: "LIB",
      part: "whole",
    });
    const merged = mergeInto(forkAndMerge, ["R1", "R3"], "whole")!;
    const child = addStep(merged.design, merged.id);
    expect(from(deleteMaterial(child.design, merged.id), child.id)).toEqual({
      of: ["R1", "R3"],
      part: "whole",
    });
  });

  test("removeNode dissolves a split and keeps the first parent of a merge", () => {
    const graph = withJunctions(toGraph(forkAndMerge));
    const dissolved = removeNode(forkAndMerge, graph, "R1::split::sort-2")!;
    expect(from(dissolved, "dep")?.split).not.toBe(from(dissolved, "str")?.split);
    const unmerged = removeNode(forkAndMerge, graph, "R3::pool")!;
    expect(from(unmerged, "R3")).toMatchObject({ of: "dep", part: "slice" });
    expect(removeNode(forkAndMerge, graph, "missing")).toBeUndefined();
  });

  test("replaceWithSample keeps the connections and refuses a placed sample", () => {
    const sample = { id: "S01", name: "Sample 1", meta: { round: 2 } };
    const replaced = replaceWithSample(forkAndMerge, "dep", sample)!;
    expect(replaced.materials.find((item) => item.id === "S01")).toMatchObject({
      sequenced: true,
      meta: { round: 2 },
      from: from(forkAndMerge, "dep"),
    });
    expect(from(replaced, "R3")?.of).toEqual(["S01", "str"]);
    expect(
      replaceWithSample(forkAndMerge, "dep", { id: "str", name: "str", meta: {} }),
    ).toBeUndefined();
    const fromShadow = replaceWithSample(forkAndMerge, "LIB", sample)!;
    expect(fromShadow.materials[0]).toEqual({
      id: "S01",
      sequenced: true,
      meta: { round: 2 },
      name: "Sample 1",
    });
    expect(from(fromShadow, "R1")?.of).toBe("S01");
  });

  test("addStartSamples adds unplaced samples as roots", () => {
    const added = addStartSamples(forkAndMerge, [
      { id: "S01", name: "S01", meta: {} },
      { id: "LIB", name: "LIB", meta: {} },
    ])!;
    expect(added.materials.at(-1)).toEqual({ id: "S01", sequenced: true, meta: {}, name: "S01" });
    expect(added.materials).toHaveLength(forkAndMerge.materials.length + 1);
  });

  test("splitLine refuses a root and a merge", () => {
    expect(splitLine(forkAndMerge, "LIB")).toBeUndefined();
    expect(splitLine(forkAndMerge, "R3")).toBeUndefined();
  });
});
