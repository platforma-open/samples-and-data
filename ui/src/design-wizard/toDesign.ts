import type { DesignMaterial } from "@platforma-open/milaboratories.samples-and-data.model";
import type { Sample } from "../design-graph/types";
import type { StudySpec, Table } from "./table";

/** The block's samples as the wizard's input table: one row per sample, blanks left out. */
export function wizardTable(
  name: string,
  columns: string[],
  samples: Sample[],
  orders: Record<string, string[]>,
): Table {
  return {
    slug: "",
    name,
    columns,
    rows: samples.map((sample) => ({
      id: sample.id,
      meta: Object.fromEntries(
        Object.entries(sample.meta)
          .map(([column, value]) => [column, String(value)] as const)
          .filter(([, value]) => value.trim() !== ""),
      ),
    })),
    orders,
  };
}

/**
 * The wizard's graph as stored design materials. Samples keep their ids; the wizard's unsequenced
 * nodes (`~hint#n`) become shadow materials, named when the hint is a column value (`day 5`).
 * The wizard's split keys hold sample ids, so splits are renamed `split-1`, `split-2` per parent,
 * as the graph editor names them.
 */
export function designMaterials(spec: StudySpec): DesignMaterial[] {
  const shadows = new Map<string, string>();
  const idOf = (id: string): string => {
    if (!id.startsWith("~")) return id;
    if (!shadows.has(id)) shadows.set(id, `shadow-${shadows.size + 1}`);
    return shadows.get(id)!;
  };
  const splits = new Map<string, Map<string, string>>();
  const splitOf = (of: string | string[], split: string) => {
    const parent = JSON.stringify(of);
    if (!splits.has(parent)) splits.set(parent, new Map());
    const names = splits.get(parent)!;
    if (!names.has(split)) names.set(split, `split-${names.size + 1}`);
    return names.get(split)!;
  };
  return Object.entries(spec.materials).map(([id, material]) => {
    const sequenced = !id.startsWith("~");
    const hint = sequenced ? "" : id.slice(1, id.lastIndexOf("#"));
    const name = /^[^=|]+=[^=|]+$/.test(hint) ? hint.replace("=", " ") : undefined;
    const from = material.from;
    return {
      id: idOf(id),
      sequenced,
      ...(name !== undefined && { name }),
      ...(from !== undefined && {
        from: {
          ...from,
          of: Array.isArray(from.of) ? from.of.map(idOf) : idOf(from.of),
          ...(from.split !== undefined && { split: splitOf(from.of, from.split) }),
        },
      }),
    };
  });
}
