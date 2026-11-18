import { parentsOf } from "./toGraph";
import type { Design, Material, MaterialFrom, Part, Step } from "./types";

const update = (design: Design, id: string, change: (material: Material) => Material): Design => ({
  materials: design.materials.map((material) => (material.id === id ? change(material) : material)),
});

const updateFrom = (
  design: Design,
  id: string,
  change: (from: MaterialFrom) => MaterialFrom,
): Design =>
  update(design, id, (material) =>
    material.from === undefined ? material : { ...material, from: change(material.from) },
  );

const singleParent = (material: Material | undefined) => {
  if (material?.from === undefined || parentsOf(material.from).length !== 1) {
    return undefined;
  }
  return parentsOf(material.from)[0];
};

/** The material with the given id. */
export const findMaterial = (design: Design, id: string) =>
  design.materials.find((material) => material.id === id);

const freeId = (design: Design) => {
  const ids = new Set(design.materials.map((material) => material.id));
  const free = (index: number): string =>
    ids.has(`material-${index}`) ? free(index + 1) : `material-${index}`;
  return free(1);
};

/** The materials made from the same single parent as `id`, `id` excluded. */
export function siblingsOf(design: Design, id: string): Material[] {
  const parent = singleParent(findMaterial(design, id));
  if (parent === undefined) {
    return [];
  }
  return design.materials.filter(
    (material) => material.id !== id && singleParent(material) === parent,
  );
}

/** A split name that no child of the parent of `id` uses yet. */
export function freshSplit(design: Design, id: string): string {
  const used = new Set(siblingsOf(design, id).map((material) => material.from?.split));
  const free = (index: number): string =>
    used.has(`split-${index}`) ? free(index + 1) : `split-${index}`;
  return free(1);
}

/** Sets what part of the parent the material holds. A slice gets its own split. */
export function setPart(design: Design, id: string, part: Part): Design {
  const split = freshSplit(design, id);
  return updateFrom(design, id, (from) => ({
    of: from.of,
    part,
    ...(part === "slice" && { split: from.split ?? split }),
    ...(from.step !== undefined && { step: from.step }),
  }));
}

/** Sets the step type; no step means a one-off step. */
export function setStep(design: Design, id: string, step?: Step): Design {
  return updateFrom(design, id, (from) => ({
    of: from.of,
    part: from.part,
    ...(from.split !== undefined && { split: from.split }),
    ...(step !== undefined && { step }),
  }));
}

/** Moves `siblingId` into the separation that `id` came out of. */
export function joinSplit(design: Design, id: string, siblingId: string): Design {
  const split = findMaterial(design, id)?.from?.split;
  if (split === undefined) {
    return design;
  }
  return updateFrom(design, siblingId, (from) => ({ ...from, part: "slice", split }));
}

/** Gives `id` a separation of its own. */
export function leaveSplit(design: Design, id: string): Design {
  const split = freshSplit(design, id);
  return updateFrom(design, id, (from) => ({ ...from, split }));
}

/** Renames a material and every reference to it. The caller checks that `newId` is free. */
export function renameMaterial(design: Design, id: string, newId: string): Design {
  const rename = (parent: string) => (parent === id ? newId : parent);
  return {
    materials: design.materials.map((material) => ({
      ...material,
      id: rename(material.id),
      ...(material.from !== undefined && {
        from: {
          ...material.from,
          of:
            typeof material.from.of === "string"
              ? rename(material.from.of)
              : material.from.of.map(rename),
        },
      }),
    })),
  };
}

/** Replaces the labels of a material. */
export function setMeta(design: Design, id: string, meta: Material["meta"]): Design {
  return update(design, id, (material) => ({ ...material, meta }));
}

/** Marks a material as sequenced or not. */
export function setSequenced(design: Design, id: string, sequenced: boolean): Design {
  return update(design, id, (material) => ({ ...material, sequenced }));
}

/** Adds a material made from `parentId` in a separation of its own (a root without a parent). */
export function addMaterial(design: Design, parentId?: string): { design: Design; id: string } {
  const id = freeId(design);
  const material: Material = {
    id,
    sequenced: false,
    meta: {},
    ...(parentId !== undefined && { from: { of: parentId, part: "slice" as const } }),
  };
  const added: Design = { materials: [...design.materials, material] };
  return { design: parentId === undefined ? added : leaveSplit(added, id), id };
}

/** Adds a partition to the separation `split` of `parentId`, with the separation's step type. */
export function addPartition(
  design: Design,
  parentId: string,
  split: string,
): { design: Design; id: string } {
  const id = freeId(design);
  const step = design.materials.find(
    (material) => singleParent(material) === parentId && material.from?.split === split,
  )?.from?.step;
  const material: Material = {
    id,
    sequenced: false,
    meta: {},
    from: { of: parentId, part: "slice", split, ...(step !== undefined && { step }) },
  };
  return { design: { materials: [...design.materials, material] }, id };
}

/** Makes `id` the first partition of a separation and adds a second partition. */
export function splitLine(
  design: Design,
  id: string,
): { design: Design; id: string; parentId: string; split: string } | undefined {
  const material = findMaterial(design, id);
  const parentId = singleParent(material);
  if (material?.from === undefined || parentId === undefined) {
    return undefined;
  }
  const split =
    material.from.part === "slice" && material.from.split !== undefined
      ? material.from.split
      : freshSplit(design, id);
  const sliced = updateFrom(design, id, (from) => ({ ...from, part: "slice", split }));
  return { ...addPartition(sliced, parentId, split), parentId, split };
}
