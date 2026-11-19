import { describe, expect, test } from "vitest";
import type { DragSource, DropTarget } from "./connect";
import { logicalEdge, planDrop } from "./connect";
import { addChildSamples, addParentSamples, disconnect, reaches } from "./edit";
import { fixture } from "./fixtures";
import { junctionId, withJunctions } from "./junctions";
import { toGraph } from "./toGraph";
import type { Design } from "./types";

const forkAndMerge = fixture("fork-and-merge");
const graphOf = (design: Design) => withJunctions(toGraph(design));
const from = (design: Design, id: string) => design.materials.find((item) => item.id === id)?.from;
const drop = (design: Design, source: DragSource, target: DropTarget) =>
  planDrop(design, graphOf(design), source, target, "whole");
const designOf = (result: ReturnType<typeof drop>) => {
  if (result === undefined || !("design" in result)) {
    throw new Error("expected a design");
  }
  return result.design;
};

describe("planDrop", () => {
  test("a child port dropped on a starting material makes it a child", () => {
    const design: Design = {
      materials: [...forkAndMerge.materials, { id: "X", sequenced: true, meta: {} }],
    };
    const result = designOf(
      drop(design, { kind: "port", nodeId: "R3", side: "out" }, { kind: "node", id: "X" }),
    );
    expect(from(result, "X")).toEqual({ of: "R3", part: "whole" });
  });

  test("a second parent turns the child into a merge", () => {
    const result = designOf(
      drop(forkAndMerge, { kind: "port", nodeId: "LIB", side: "out" }, { kind: "node", id: "str" }),
    );
    expect(from(result, "str")?.of).toEqual(["R1", "LIB"]);
  });

  test("a drop that would make a cycle is refused", () => {
    expect(
      drop(forkAndMerge, { kind: "port", nodeId: "R3", side: "out" }, { kind: "node", id: "R1" }),
    ).toBeUndefined();
    expect(
      drop(forkAndMerge, { kind: "port", nodeId: "R1", side: "in" }, { kind: "node", id: "R1" }),
    ).toBeUndefined();
  });

  test("a parent port dropped on an edge joins that edge's separation", () => {
    const design: Design = {
      materials: [...forkAndMerge.materials, { id: "X", sequenced: true, meta: {} }],
    };
    const result = designOf(
      drop(design, { kind: "port", nodeId: "X", side: "in" }, { kind: "edge", id: "LIB->R1" }),
    );
    expect(from(result, "X")).toEqual({ of: "LIB", part: "slice", split: "pan-1", step: "round" });
  });

  test("a parent port dropped on a split point joins that split", () => {
    const design: Design = {
      materials: [...forkAndMerge.materials, { id: "X", sequenced: true, meta: {} }],
    };
    const result = designOf(
      drop(
        design,
        { kind: "port", nodeId: "X", side: "in" },
        { kind: "node", id: junctionId("R1", "sort-2") },
      ),
    );
    expect(from(result, "X")).toMatchObject({ of: "R1", split: "sort-2" });
  });

  test("a child port dropped on empty space opens the picker; on an edge it is refused", () => {
    expect(
      drop(forkAndMerge, { kind: "port", nodeId: "R3", side: "out" }, { kind: "empty" }),
    ).toEqual({
      picker: { nodeId: "R3", side: "out" },
    });
    expect(
      drop(
        forkAndMerge,
        { kind: "port", nodeId: "R3", side: "out" },
        { kind: "edge", id: "LIB->R1" },
      ),
    ).toBeUndefined();
  });

  test("an edge's parent end moves the child to another parent", () => {
    const result = designOf(
      drop(
        forkAndMerge,
        { kind: "end", edgeId: "dep->R3::pool", end: "parent" },
        { kind: "node", id: "R1" },
      ),
    );
    expect(from(result, "R3")?.of).toEqual(["R1", "str"]);
  });

  test("an edge's child end moves the parent to another child", () => {
    const design: Design = {
      materials: [...forkAndMerge.materials, { id: "X", sequenced: true, meta: {} }],
    };
    const result = designOf(
      drop(design, { kind: "end", edgeId: "LIB->R1", end: "child" }, { kind: "node", id: "X" }),
    );
    expect(from(result, "R1")).toBeUndefined();
    expect(from(result, "X")).toEqual({
      of: "LIB",
      part: "slice",
      split: "split-1",
      step: "round",
    });
  });

  test("a join that would drop a material's other parents is refused", () => {
    expect(
      drop(
        forkAndMerge,
        { kind: "port", nodeId: "R3", side: "in" },
        { kind: "edge", id: "LIB->R1" },
      ),
    ).toBeUndefined();
    expect(
      drop(
        forkAndMerge,
        { kind: "end", edgeId: "dep->R3::pool", end: "parent" },
        { kind: "edge", id: "LIB->R1" },
      ),
    ).toBeUndefined();
  });

  test("a drop that changes nothing is refused", () => {
    expect(
      drop(
        forkAndMerge,
        { kind: "end", edgeId: `${junctionId("R1", "sort-2")}->str`, end: "parent" },
        { kind: "node", id: junctionId("R1", "sort-2") },
      ),
    ).toBeUndefined();
  });
});

describe("logicalEdge", () => {
  test("reads through split points and merges", () => {
    const graph = graphOf(forkAndMerge);
    expect(logicalEdge(graph, `${junctionId("R1", "sort-2")}->dep`)).toEqual({
      parentId: "R1",
      childId: "dep",
    });
    expect(logicalEdge(graph, "str->R3::pool")).toEqual({ parentId: "str", childId: "R3" });
    expect(logicalEdge(graph, "R3::pool->R3")).toBeUndefined();
  });
});

describe("sample edits", () => {
  const samples = ["S01", "S02", "S03"].map((id) => ({ id, name: id, meta: {} }));

  test("slice children added together form one separation", () => {
    const result = addChildSamples(forkAndMerge, "R3", samples.slice(0, 2), "slice")!;
    expect(from(result, samples[0].id)).toEqual({ of: "R3", part: "slice", split: "split-1" });
    expect(from(result, samples[1].id)).toEqual(from(result, samples[0].id));
  });

  test("several parents make a merge", () => {
    const result = addParentSamples(forkAndMerge, "LIB", samples.slice(0, 2), "whole")!;
    expect(from(result, "LIB")).toEqual({ of: [samples[0].id, samples[1].id], part: "whole" });
  });

  test("disconnect drops one parent, and the last one makes a starting material", () => {
    expect(from(disconnect(forkAndMerge, "dep", "R3"), "R3")).toEqual({
      of: "str",
      part: "slice",
      split: "split-1",
      step: "round",
    });
    expect(from(disconnect(forkAndMerge, "LIB", "R1"), "R1")).toBeUndefined();
  });

  test("samples already in the design are not added again", () => {
    expect(
      addChildSamples(forkAndMerge, "R3", [{ id: "R1", name: "R1", meta: {} }], "slice"),
    ).toBeUndefined();
  });

  test("reaches follows children", () => {
    expect(reaches(forkAndMerge, "LIB", "R3")).toBe(true);
    expect(reaches(forkAndMerge, "R3", "LIB")).toBe(false);
  });
});
