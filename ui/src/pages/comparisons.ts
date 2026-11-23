import type { TensorRow } from "@platforma-open/milaboratories.samples-and-data.model";

/**
 * Comparisons of one panel arm with the same type, axis and group names, told apart by their other
 * columns. An arm is its own material, so two arms never collapse into one line; the pieces of one
 * arm (gates, bins) do.
 */
export type ComparisonSection = {
  key: string;
  /** The panel arms every row of this section runs through; empty outside a panel. */
  arms: string[];
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
  // An arm is its own material, so the comparisons inside one arm list together and the pieces of
  // that arm (gates, bins) collapse into the line. Where every arm holds a single comparison there
  // is nothing to collapse, so the arm is left to be read as the factor that tells the rows apart.
  const byArm: [string, TensorRow[]][] = [];
  for (const [key, members] of byShape) {
    const arms = Map.groupBy(members, (row) => row.armKeys.join("\u0000"));
    if ([...arms.values()].some((rows) => rows.length > 1))
      for (const [arm, rows] of arms) byArm.push([`${key}\u0000${arm}`, rows]);
    else byArm.push([key, members]);
  }
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
  return byArm.map(([key, members]) => {
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
      arms: members.every((r) => r.armKeys.join() === members[0]!.armKeys.join())
        ? members[0]!.arms
        : [],
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
