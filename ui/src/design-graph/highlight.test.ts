import { expect, test } from "vitest";
import { fixture } from "./fixtures";
import { litPart } from "./highlight";
import { junctionId, withJunctions } from "./junctions";
import { toGraph } from "./toGraph";

const graph = withJunctions(toGraph(fixture("fork-and-merge")));
const edge = (from: string, to: string) =>
  graph.edges.find((e) => e.from === from && e.to === to)!.id;

test("a separation lights its pieces, its junction and the divided material", () => {
  const lit = litPart(graph, new Set(["dep", "str"]));
  const junction = junctionId("R1", "sort-2");
  expect(lit.nodes).toEqual(new Set(["dep", "str", junction, "R1"]));
  expect(lit.edges).toEqual(
    new Set([edge("R1", junction), edge(junction, "dep"), edge(junction, "str")]),
  );
});

test("a path lights the nodes between its samples, not what lies above or beside it", () => {
  const lit = litPart(graph, new Set(["R1", "dep", "R3"]));
  expect(lit.nodes.has("LIB")).toBe(false);
  expect(lit.nodes.has("str")).toBe(true); // R3 was pooled from dep and str, both below R1
  expect(lit.nodes.has("R3")).toBe(true);
});
