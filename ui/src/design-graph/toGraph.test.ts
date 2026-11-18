import { describe, expect, test } from "vitest";
import { designFixtures, fixture } from "./fixtures";
import { toGraph } from "./toGraph";
import type { Design } from "./types";

describe("toGraph", () => {
  test("inserts a pool node and pooled edges for a material with several parents", () => {
    const graph = toGraph(fixture("fork-and-merge"));
    expect(graph.nodes.find((node) => node.id === "R3::pool")).toEqual({
      id: "R3::pool",
      kind: "pool",
      sequenced: false,
      meta: {},
      hidden: false,
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
