import type { Sample } from "./types";

/** One filter value: a label column and one of its values. */
export type SampleFilter = { column: string; cell: string };

/** Each distinct label value of the samples as a filter option: columns in table order, values in natural order. */
export function filterOptions(samples: Pick<Sample, "meta">[]) {
  const cells = samples.flatMap((sample) =>
    Object.entries(sample.meta).map(([column, value]) => ({ column, cell: String(value) })),
  );
  const unique = new Map(
    cells.map((filter) => [JSON.stringify([filter.column, filter.cell]), filter]),
  );
  return Map.groupBy(unique.values(), (filter) => filter.column)
    .values()
    .flatMap((group) =>
      group.toSorted((left, right) =>
        left.cell.localeCompare(right.cell, undefined, { numeric: true }),
      ),
    )
    .map((filter) => ({ label: `${filter.column}: ${filter.cell}`, value: filter }))
    .toArray();
}

/** Whether a sample matches: any chosen value within a column, and every filtered column. */
export function matchesFilters(sample: Pick<Sample, "meta">, filters: SampleFilter[]): boolean {
  return Map.groupBy(filters, (filter) => filter.column)
    .entries()
    .every(([column, group]) => {
      const value = sample.meta[column];
      return value !== undefined && group.some((filter) => filter.cell === String(value));
    });
}
