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
  /** The row the collapsed line reads from: the first on the axis most of them share. */
  lead: TensorRow;
  rows: (TensorRow & { factorValues: string })[];
  /** Columns whose value changes from row to row: the factors the section is collapsed by. */
  factors: string[];
  /** Constants every row shares. */
  shared: string[];
};

const column = (tag: string) => tag.slice(0, tag.indexOf(" = "));

export function comparisonSections(rows: TensorRow[]): ComparisonSection[] {
  // An arm is its own material, so the comparisons inside one arm list together, whatever axis each
  // of them was labelled by: a column filled for one gate only (vfp1602's ladders) names that gate's
  // trajectory and no other, and the three gates of an arm still belong on one line. An arm holding
  // a single comparison has nothing to collapse, so those fall back to shape and the arm is read as
  // the factor that tells them apart.
  const armOf = (row: TensorRow) => row.armKeys.join("\u0000");
  const perArm = new Map<string, number>();
  for (const row of rows)
    if (row.armKeys.length > 0) perArm.set(armOf(row), (perArm.get(armOf(row)) ?? 0) + 1);
  const byShape = Map.groupBy(rows, (row) =>
    (perArm.get(armOf(row)) ?? 0) > 1
      ? ["arm", row.type, armOf(row)].join("\u0000")
      : [row.type, row.by, ...row.groups.map((group) => group.name)].join("\u0000"),
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
    const onAxis = (by: string) => members.filter((r) => r.by === by).length;
    const lead = members.reduce((a, b) => (onAxis(b.by) > onAxis(a.by) ? b : a));
    return {
      key,
      lead,
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
