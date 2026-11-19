import { describe, expect, test } from "vitest";
import { addMergedChildren, mergeInto, setPart } from "./edit";
import { designFixtures, fixture } from "./fixtures";
import { withJunctions } from "./junctions";
import { toGraph } from "./toGraph";
import type { Design } from "./types";

describe("toGraph", () => {
  const forkAndMerge = fixture("fork-and-merge");
  const samples = ["S01", "S02"].map((id) => ({ id, name: id, meta: {} }));
  const drawn = (design: Design) => withJunctions(toGraph(design));

  test("draws a merge into a shadow node as one node, with no pool", () => {
    const merged = mergeInto(forkAndMerge, ["dep", "str"])!;
    const graph = drawn(merged.design);
    expect(graph.nodes).toHaveLength(drawn(forkAndMerge).nodes.length + 1);
    const into = graph.edges.filter((edge) => edge.to === merged.id);
    expect(into.map((edge) => [edge.from, edge.part])).toEqual([
      ["dep", "pooled"],
      ["str", "pooled"],
    ]);
  });

  test("keeps the pool for a shadow node that slices its merged parents", () => {
    const merged = mergeInto(forkAndMerge, ["dep", "str"])!;
    const sliced = setPart(merged.design, merged.id, "slice");
    expect(drawn(sliced).nodes.some((node) => node.id === `${merged.id}::pool`)).toBe(true);
  });

  test("draws children added to several parents as one shadow node and its children, with no junction", () => {
    const added = addMergedChildren(forkAndMerge, ["dep", "str"], samples, "slice")!;
    const graph = drawn(added.design);
    expect(graph.nodes).toHaveLength(drawn(forkAndMerge).nodes.length + 3);
    expect(graph.edges.filter((edge) => edge.from === added.id).map((edge) => edge.to)).toEqual([
      "S01",
      "S02",
    ]);
  });

  test("inserts a pool node and pooled edges for a material with several parents", () => {
    const graph = toGraph(fixture("fork-and-merge"));
    expect(graph.nodes.find((node) => node.id === "R3::pool")).toEqual({
      id: "R3::pool",
      kind: "pool",
      sequenced: false,
      meta: {},
    });
    expect(graph.edges.filter((edge) => edge.to === "R3::pool")).toEqual([
      {
        id: "dep->R3::pool",
        from: "dep",
        to: "R3::pool",
        part: "pooled",
        split: null,
        step: null,
        inserted: true,
      },
      {
        id: "str->R3::pool",
        from: "str",
        to: "R3::pool",
        part: "pooled",
        split: null,
        step: null,
        inserted: true,
      },
    ]);
    expect(graph.edges.filter((edge) => edge.to === "R3")).toEqual([
      {
        id: "R3::pool->R3",
        from: "R3::pool",
        to: "R3",
        part: "slice",
        split: "pan-3",
        step: "round",
        inserted: true,
      },
    ]);
  });

  test("keeps the invariants of GRAPH.md on every fixture", () => {
    for (const { design } of designFixtures) {
      const graph = toGraph(design);
      const kind = new Map(graph.nodes.map((node) => [node.id, node.kind]));
      const incoming = Map.groupBy(graph.edges, (edge) => edge.to);
      const outgoing = Map.groupBy(graph.edges, (edge) => edge.from);
      for (const node of graph.nodes) {
        const into = incoming.get(node.id) ?? [];
        if (!node.sequenced) expect(node.meta).toEqual({});
        if (node.kind === "material") expect(into.length).toBeLessThanOrEqual(1);
        if (node.kind === "pool") {
          expect(into.length).toBeGreaterThanOrEqual(2);
          expect(into.every((edge) => edge.part === "pooled")).toBe(true);
          expect(outgoing.get(node.id)?.length).toBe(1);
        }
      }
      for (const edge of graph.edges) {
        expect(edge.split !== null).toBe(edge.part === "slice");
        if (edge.part === "pooled") expect(kind.get(edge.to)).toBe("pool");
      }
    }
  });

  test("drops a split on a non-slice edge", () => {
    const design: Design = {
      materials: [
        { id: "A", sequenced: true, meta: {} },
        { id: "B", sequenced: true, meta: {}, from: { of: "A", part: "whole", split: "stray" } },
      ],
    };
    expect(toGraph(design).edges[0].split).toBeNull();
  });

  test("refuses an unknown parent and a cycle", () => {
    expect(() =>
      toGraph({
        materials: [{ id: "A", sequenced: true, meta: {}, from: { of: "X", part: "whole" } }],
      }),
    ).toThrow(/unknown material "X"/);
    expect(() =>
      toGraph({
        materials: [
          { id: "A", sequenced: true, meta: {} },
          { id: "B", sequenced: true, meta: {}, from: { of: "A", part: "slice" } },
        ],
      }),
    ).toThrow(/without a split/);
    expect(() =>
      toGraph({
        materials: [
          { id: "A", sequenced: true, meta: {}, from: { of: "B", part: "whole" } },
          { id: "B", sequenced: true, meta: {}, from: { of: "A", part: "whole" } },
        ],
      }),
    ).toThrow(/cycle/);
  });
});
