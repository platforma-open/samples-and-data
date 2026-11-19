import { describe, expect, test } from "vitest";
import { addPartition, addStart, insertStep } from "./edit";
import { designFixtures, fixture } from "./fixtures";
import { withJunctions } from "./junctions";
import type { Layout } from "./layout";
import { layout } from "./layout";
import { toGraph } from "./toGraph";

const at = (result: Layout, id: string) => result.nodes.find((node) => node.id === id)!;
const centerY = (result: Layout, id: string) => at(result, id).y + at(result, id).h / 2;

describe("layout", () => {
  test("takes columns from the graph only, not from round labels", () => {
    const result = layout(toGraph(fixture("skipped-rounds")));
    const columnX = (id: string) => at(result, id).x;
    expect(columnX("Q_R3")).toBe(columnX("P_R2"));
    expect(columnX("S_R2")).toBe(columnX("P_R1"));
    expect(centerY(result, "Q_R1")).toBe(centerY(result, "Q_R3"));
  });

  test("stacks a canvas of unconnected samples in one column, in design order", () => {
    const loose = [3, 1, 2].map((round) => ({ id: `S${round}`, sequenced: true, meta: { round } }));
    const result = layout(toGraph({ materials: loose }));
    const ys = loose.map((item) => centerY(result, item.id));
    expect(loose.map((item) => at(result, item.id).x)).toEqual([0, 0, 0]);
    expect(ys).toEqual(ys.toSorted((left, right) => left - right));
  });

  test("stacks unconnected nodes in the first column after the connected trees", () => {
    const loose = ["S10", "S02", "S07"].map((id) => ({ id, sequenced: true, meta: { round: 3 } }));
    const tree = fixture("fork-and-merge").materials;
    const result = layout(
      toGraph({ materials: [...loose.slice(0, 1), ...tree, ...loose.slice(1)] }),
    );
    const ys = loose.map((item) => centerY(result, item.id));
    expect(loose.map((item) => at(result, item.id).x)).toEqual([0, 0, 0]);
    expect(ys).toEqual(ys.toSorted((left, right) => left - right));
    expect(new Set(ys).size).toBe(3);
    const treeBottom = Math.max(...tree.map((item) => centerY(result, item.id)));
    expect(Math.min(...ys)).toBeGreaterThan(treeBottom);
  });

  test("puts a pool in its own column between its parents and its child", () => {
    const result = layout(toGraph(fixture("fork-and-merge")));
    const pool = at(result, "R3::pool");
    expect(pool.x).toBeGreaterThan(at(result, "dep").x + at(result, "dep").w);
    expect(at(result, "R3").x).toBeGreaterThan(pool.x + pool.w);
    expect(centerY(result, "R3::pool")).toBe((centerY(result, "dep") + centerY(result, "str")) / 2);
    expect(centerY(result, "R3")).toBe(centerY(result, "R3::pool"));
  });

  test("advances one column per edge", () => {
    const result = layout(toGraph(fixture("scan-then-combine")));
    const xs = ["SCAN", "S1_IN", "S1_OUT", "COMBO", "t1_lo"].map((id) => at(result, id).x);
    expect(xs).toEqual(xs.toSorted((left, right) => left - right));
    expect(new Set(xs).size).toBe(xs.length);
  });

  test("never overlaps two nodes", () => {
    const withAdded = insertStep(
      addPartition(addStart(fixture("fork-and-merge")).design, "R1", "sort-2").design,
      "R3",
    )!.design;
    const designs = [...designFixtures.map((item) => item.design), withAdded];
    for (const design of designs) {
      const { nodes } = layout(withJunctions(toGraph(design)));
      for (const [index, first] of nodes.entries()) {
        for (const second of nodes.slice(index + 1)) {
          const apart =
            first.x + first.w <= second.x ||
            second.x + second.w <= first.x ||
            first.y + first.h <= second.y ||
            second.y + second.h <= first.y;
          expect(apart, `${first.id} overlaps ${second.id}`).toBe(true);
        }
      }
    }
  });

  test("routes edges from the middle of the parent's right side to the middle of the child's left side", () => {
    const graph = toGraph(fixture("two-arms-one-sort"));
    const result = layout(graph);
    for (const [index, edge] of result.edges.entries()) {
      const { from: parent, to: child } = graph.edges[index];
      expect(edge.from).toEqual({
        x: at(result, parent).x + at(result, parent).w,
        y: centerY(result, parent),
      });
      expect(edge.to).toEqual({ x: at(result, child).x, y: centerY(result, child) });
    }
  });

  test("changes rows only inside a column gap that no card overlaps", () => {
    for (const { design } of designFixtures) {
      const graph = withJunctions(toGraph(design));
      const result = layout(graph);
      const cards = result.nodes.filter(
        (node) => graph.nodes.find((item) => item.id === node.id)!.kind !== "junction",
      );
      for (const { id, from, to, bend } of result.edges) {
        const [start, end] = bend;
        expect(from.x, id).toBeLessThanOrEqual(start);
        expect(start, id).toBeLessThanOrEqual(end);
        expect(end, id).toBeLessThanOrEqual(to.x);
        const crossed = cards.filter((card) => card.x < end && card.x + card.w > start);
        expect(
          crossed.map((card) => card.id),
          id,
        ).toEqual([]);
      }
    }
  });
});
