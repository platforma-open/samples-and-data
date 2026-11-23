import type { TensorRow } from "@platforma-open/milaboratories.samples-and-data.model";

/** Comparisons with the same type, axis and group names, told apart by their other columns. */
export type ComparisonSection = {
  key: string;
  rows: (TensorRow & { factorValues: string })[];
  /** Columns whose value changes from row to row: the factors the section is collapsed by. */
  factors: string[];
  /** Constants every row shares. */
  shared: string[];
};

const column = (tag: string) => tag.slice(0, tag.indexOf(" = "));

export function comparisonSections(rows: TensorRow[]): ComparisonSection[] {
  const byShape = Map.groupBy(rows, (row) =>
    [row.type, row.by, ...row.groups.map((group) => group.name)].join("\u0000"),
  );
  // Same-shaped comparisons are told apart by their constants, by the columns that vary inside them
  // without naming their groups, and by what names their last position; a column every row agrees
  // on names nothing, so it is left out.
  // One tag per column: where a comparison ends beats the values it passed through.
  const tags = (row: TensorRow) => {
    const byColumn = new Map<string, string>();
    for (const tag of [...row.constant, ...row.varies, ...row.endpoint])
      byColumn.set(column(tag), tag);
    return [...byColumn.values()];
  };
  return [...byShape].map(([key, members]) => {
    const common = tags(members[0]).filter((c) => members.every((r) => tags(r).includes(c)));
    const factors = [
      ...new Set(
        members.flatMap((r) =>
          tags(r)
            .filter((c) => !common.includes(c))
            .map(column),
        ),
      ),
    ];
    return {
      key,
      factors,
      shared: members[0].constant.filter((c) => common.includes(c)),
      rows: members.map((row) => ({
        ...row,
        factorValues: tags(row)
          .filter((c) => factors.includes(column(c)))
          .map((c) => c.slice(column(c).length + 3))
          .join(" · "),
      })),
    };
  });
}
