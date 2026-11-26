import { describe, expect, test } from "vitest";
import { withJunctions } from "../design-graph/junctions";
import { toGraph } from "../design-graph/toGraph";
import { editorDesign } from "../design_table";
import type { ConfigB } from "./lineage";
import { buildB } from "./lineage";
import type { Table } from "./table";
import { designMaterials } from "./toDesign";
import studies from "./synthetic-studies.json";

type Study = { slug: string; table: Table; suggested: ConfigB; answered: ConfigB };

describe.each(studies as unknown as Study[])("$slug", (study) => {
  test.each(["suggested", "answered"] as const)("the %s draft is a drawable design", (which) => {
    const materials = designMaterials(buildB(study.table, study[which]));
    const ids = new Set(materials.map((material) => material.id));
    const sampleIds = new Set(study.table.rows.map((row) => row.id));

    expect(ids.size).toBe(materials.length);
    for (const material of materials) {
      expect(material.sequenced).toBe(sampleIds.has(material.id));
      if (!material.sequenced) expect(material.id).toMatch(/^shadow-\d+$/);
      for (const parent of [material.from?.of ?? []].flat()) expect(ids.has(parent)).toBe(true);
      if (material.from?.split !== undefined) expect(material.from.split).toMatch(/^split-\d+$/);
    }
    const samples = study.table.rows.map((row) => ({ id: row.id, name: row.id, meta: row.meta }));
    expect(() => withJunctions(toGraph(editorDesign(materials, samples)))).not.toThrow();

    // renaming splits keeps which slices came out of one separation
    const groups = (split: (id: string) => string | undefined) =>
      materials.map((a) =>
        materials.map((b) => split(a.id) !== undefined && split(a.id) === split(b.id)),
      );
    const spec = buildB(study.table, study[which]).materials;
    const shadowOf = new Map<string, string>();
    Object.keys(spec).forEach((id, at) => shadowOf.set(materials[at]!.id, id));
    const before = (id: string) => {
      const from = spec[shadowOf.get(id)!]?.from;
      return from?.split === undefined ? undefined : `${JSON.stringify(from.of)}|${from.split}`;
    };
    const after = (id: string) => {
      const from = materials.find((material) => material.id === id)?.from;
      return from?.split === undefined ? undefined : `${JSON.stringify(from.of)}|${from.split}`;
    };
    expect(groups(after)).toEqual(groups(before));
  });
});
