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

const shadowId = (design: Design) => {
  const ids = new Set(design.materials.map((material) => material.id));
  const free = (index: number): string =>
    ids.has(`shadow-${index}`) ? free(index + 1) : `shadow-${index}`;
  return free(1);
};

const shadow = (id: string, from?: MaterialFrom): Material => ({
  id,
  sequenced: false,
  meta: {},
  ...(from !== undefined && { from }),
});

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

/** Sets or clears the name of a shadow material. */
export function setName(design: Design, id: string, name?: string): Design {
  return update(design, id, ({ name: _name, ...material }) => ({
    ...material,
    ...(name !== undefined && { name }),
  }));
}

/** Adds a starting material: a shadow node with no parent. */
export function addStart(design: Design): { design: Design; id: string } {
  const id = shadowId(design);
  return { design: { materials: [...design.materials, shadow(id)] }, id };
}

/** Adds a shadow step made from all of `parentId`. */
export function addStep(design: Design, parentId: string): { design: Design; id: string } {
  const id = shadowId(design);
  const step = shadow(id, { of: parentId, part: "whole" });
  return { design: { materials: [...design.materials, step] }, id };
}

/** Inserts a shadow step between `id` and its parents; the step takes over how `id` was made. */
export function insertStep(design: Design, id: string): { design: Design; id: string } | undefined {
  const from = findMaterial(design, id)?.from;
  if (from === undefined) {
    return undefined;
  }
  const stepId = shadowId(design);
  const moved = updateFrom(design, id, () => ({ of: stepId, part: "whole" }));
  const index = design.materials.findIndex((material) => material.id === id);
  return {
    design: { materials: moved.materials.toSpliced(index, 0, shadow(stepId, from)) },
    id: stepId,
  };
}

/** Adds a partition to the separation `split` of `parentId`, with the separation's step type. */
export function addPartition(
  design: Design,
  parentId: string,
  split: string,
): { design: Design; id: string } {
  const id = shadowId(design);
  const step = design.materials.find(
    (material) => singleParent(material) === parentId && material.from?.split === split,
  )?.from?.step;
  const material = shadow(id, {
    of: parentId,
    part: "slice",
    split,
    ...(step !== undefined && { step }),
  });
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
