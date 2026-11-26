import { describe, expect, test } from "vitest";
import { countOf } from "./string_utils";

describe("countOf", () => {
  test("keeps the noun singular for one", () => {
    expect(countOf(1, "trajectory")).toBe("1 trajectory");
    expect(countOf(1, "panel")).toBe("1 panel");
    expect(countOf(1, "partition")).toBe("1 partition");
    expect(countOf(1, "recurrence")).toBe("1 recurrence");
  });

  test("pluralises everything else, -y as -ies", () => {
    expect(countOf(0, "trajectory")).toBe("0 trajectories");
    expect(countOf(2, "trajectory")).toBe("2 trajectories");
    expect(countOf(2, "panel")).toBe("2 panels");
    expect(countOf(3, "recurrence")).toBe("3 recurrences");
  });
});
