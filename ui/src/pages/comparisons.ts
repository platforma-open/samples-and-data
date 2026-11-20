import type { TensorRow } from "@platforma-open/milaboratories.samples-and-data.model";

/** Comparisons with the same type, axis and group names, differing only in their constant columns. */
export type ComparisonSection = {
  key: string;
  rows: (TensorRow & { factorValues: string })[];
  /** Constant columns whose value changes from row to row: the factors the section is collapsed by. */
  factors: string[];
  /** Constants every row shares. */
  shared: string[];
};

const column = (constant: string) => constant.slice(0, constant.indexOf(" = "));

export function comparisonSections(rows: TensorRow[]): ComparisonSection[] {
  const byShape = Map.groupBy(rows, (row) =>
    [row.type, row.by, ...row.groups.map((group) => group.name)].join("\u0000"),
  );
  return [...byShape].map(([key, members]) => {
    const shared = members[0].constant.filter((c) => members.every((r) => r.constant.includes(c)));
    const factors = [
      ...new Set(members.flatMap((r) => r.constant.filter((c) => !shared.includes(c)).map(column))),
    ];
    return {
      key,
      factors,
      shared,
      rows: members.map((row) => ({
        ...row,
        factorValues: row.constant
          .filter((c) => factors.includes(column(c)))
          .map((c) => c.slice(column(c).length + 3))
          .join(" · "),
      })),
    };
  });
}
