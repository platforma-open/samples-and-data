import { describe, expect, test } from "vitest";
import { leaveSplit } from "./edit";
import { fixture } from "./fixtures";
import { junctionId, withJunctions } from "./junctions";
import { layout } from "./layout";
import { toGraph } from "./toGraph";
import type { Design } from "./types";

describe("withJunctions", () => {
  test("adds a shadow junction for a separation with several partitions", () => {
    const graph = withJunctions(toGraph(fixture("fork-and-merge")));
    const junction = junctionId("R1", "sort-2");
    expect(graph.nodes.find((node) => node.id === junction)).toMatchObject({
      kind: "junction",
      sequenced: false,
    });
    expect(graph.edges.filter((edge) => edge.to === junction).map((edge) => edge.from)).toEqual([
      "R1",
    ]);
    expect(graph.edges.filter((edge) => edge.from === junction).map((edge) => edge.to)).toEqual([
      "dep",
      "str",
    ]);
    expect(graph.edges.some((edge) => edge.from === "R1" && edge.to === "dep")).toBe(false);
  });

  test("adds no junction for a separation with one partition", () => {
    const graph = withJunctions(toGraph(fixture("skipped-rounds")));
    expect(graph.nodes.some((node) => node.kind === "junction")).toBe(false);
  });

  test("gives each separation of one parent its own junction", () => {
    const graph = withJunctions(toGraph(fixture("scan-then-combine")));
    const junctions = graph.nodes.filter((node) => node.kind === "junction");
    expect(junctions.map((node) => node.id)).toEqual(
      ["titrate-1", "titrate-2", "titrate-3"].map((split) => junctionId("COMBO", split)),
    );
  });

  test("gives each separation of one parent its own branch point", () => {
    const result = layout(withJunctions(toGraph(fixture("scan-then-combine"))));
    const junctions = result.nodes.filter((node) => node.id.startsWith("COMBO::split::"));
    expect(new Set(junctions.map((node) => node.x)).size).toBe(1);
    expect(new Set(junctions.map((node) => node.y)).size).toBe(3);
  });

  test("keeps a material's incoming edge pointing at it across the one-partition boundary", () => {
    const apart = leaveSplit(fixture("fork-and-merge"), "str");
    const incoming = (design: Design) =>
      withJunctions(toGraph(design)).edges.filter((edge) => edge.to === "dep");
    expect(incoming(apart)).toHaveLength(1);
    expect(incoming(fixture("fork-and-merge"))).toHaveLength(1);
  });

  test("places a junction at the branch point, between the parent and its partitions", () => {
    const graph = withJunctions(toGraph(fixture("fork-and-merge")));
    const result = layout(graph);
    const at = (id: string) => result.nodes.find((node) => node.id === id)!;
    const junction = at(junctionId("R1", "sort-2"));
    const center = junction.x + junction.w / 2;
    expect(center).toBeGreaterThan(at("R1").x + at("R1").w);
    expect(center).toBeLessThan(at("dep").x);
    const junctionCenter = { x: center, y: junction.y + junction.h / 2 };
    const branch = result.edges.find((edge) => edge.id.endsWith("->dep"))!;
    const stem = result.edges.find((edge) => edge.id === `R1->${junction.id}`)!;
    expect(branch.from).toEqual(junctionCenter);
    expect(stem.to).toEqual(junctionCenter);
    expect(stem.from.y).toBe(junctionCenter.y);
  });
});
