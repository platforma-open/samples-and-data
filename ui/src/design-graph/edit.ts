import { junctionOf } from "./junctions";
import { parentsOf } from "./toGraph";
import type { Design, Graph, Material, MaterialFrom, Part, Sample, Step } from "./types";

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

const freeName = (prefix: string, used: Set<string | undefined>) => {
  const free = (index: number): string =>
    used.has(`${prefix}-${index}`) ? free(index + 1) : `${prefix}-${index}`;
  return free(1);
};

const shadowId = (design: Design) =>
  freeName("shadow", new Set(design.materials.map((material) => material.id)));

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
  return freeName("split", new Set(siblingsOf(design, id).map((material) => material.from?.split)));
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

/** A split name that no child of `parentId` uses yet. */
export function freeSplitOf(design: Design, parentId: string): string {
  return freeName(
    "split",
    new Set(
      design.materials
        .filter((material) => singleParent(material) === parentId)
        .map((material) => material.from?.split),
    ),
  );
}

/** Whether `targetId` is `id` or one of its descendants. */
export function reaches(design: Design, id: string, targetId: string): boolean {
  const children = (parentId: string) =>
    design.materials
      .filter(
        (material) => material.from !== undefined && parentsOf(material.from).includes(parentId),
      )
      .map((material) => material.id);
  const visit = (current: string, seen: Set<string>): boolean =>
    current === targetId ||
    children(current).some(
      (child) => !seen.has(child) && visit(child, seen.union(new Set([child]))),
    );
  return visit(id, new Set([id]));
}

const sliceFrom = (parentId: string | string[], part: Part, split: string): MaterialFrom => ({
  of: parentId,
  part,
  ...(part === "slice" && { split }),
});

/** Makes `parentId` a parent of `childId`: its first parent, or one more parent of a merge. */
export function connect(
  design: Design,
  parentId: string,
  childId: string,
  part: Part,
): Design | undefined {
  const child = findMaterial(design, childId);
  if (child === undefined || reaches(design, childId, parentId)) {
    return undefined;
  }
  if (child.from === undefined) {
    const from = sliceFrom(parentId, part, freeSplitOf(design, parentId));
    return update(design, childId, (material) => ({ ...material, from }));
  }
  const parents = parentsOf(child.from);
  if (parents.includes(parentId)) {
    return undefined;
  }
  return updateFrom(design, childId, (from) => ({ ...from, of: [...parents, parentId] }));
}

/** Removes `parentId` from the parents of `childId`; with no parent left it becomes a starting material. */
export function disconnect(design: Design, parentId: string, childId: string): Design {
  const from = findMaterial(design, childId)?.from;
  if (from === undefined) {
    return design;
  }
  const rest = parentsOf(from).filter((parent) => parent !== parentId);
  if (rest.length === 0) {
    return update(design, childId, ({ from: _from, ...material }) => material);
  }
  const single = rest.length === 1;
  return updateFrom(design, childId, (current) => ({
    ...current,
    of: single ? rest[0] : rest,
    ...(single && current.part === "slice" && { split: freeSplitOf(design, rest[0]) }),
  }));
}

/** Moves `childId` from `oldParentId` to `newParentId`. */
export function reparent(
  design: Design,
  childId: string,
  oldParentId: string,
  newParentId: string,
): Design | undefined {
  const from = findMaterial(design, childId)?.from;
  if (from === undefined || reaches(design, childId, newParentId)) {
    return undefined;
  }
  const parents = parentsOf(from);
  if (parents.includes(newParentId)) {
    return undefined;
  }
  const of = parents.map((parent) => (parent === oldParentId ? newParentId : parent));
  const single = of.length === 1;
  return updateFrom(design, childId, (current) => ({
    ...current,
    of: single ? of[0] : of,
    ...(single && current.part === "slice" && { split: freeSplitOf(design, newParentId) }),
  }));
}

/** Makes `childId` a partition of the separation `siblingId` came out of under `parentId`, creating it if needed. */
export function joinSeparation(
  design: Design,
  childId: string,
  parentId: string,
  siblingId: string,
): Design | undefined {
  const sibling = findMaterial(design, siblingId);
  if (
    sibling?.from === undefined ||
    childId === siblingId ||
    singleParent(sibling) !== parentId ||
    reaches(design, childId, parentId)
  ) {
    return undefined;
  }
  const split =
    sibling.from.part === "slice" && sibling.from.split !== undefined
      ? sibling.from.split
      : freeSplitOf(design, parentId);
  const step = sibling.from.step;
  const sliced = updateFrom(design, siblingId, (from) => ({ ...from, part: "slice", split }));
  return update(sliced, childId, (material) => ({
    ...material,
    from: { of: parentId, part: "slice", split, ...(step !== undefined && { step }) },
  }));
}

const sampleMaterial = (sample: Sample, from?: MaterialFrom): Material => ({
  id: sample.id,
  sequenced: true,
  meta: sample.meta,
  ...(from !== undefined && { from }),
});

const unplaced = (design: Design, samples: Sample[]) =>
  samples.filter((sample) => findMaterial(design, sample.id) === undefined);

/** Adds samples as children of `parentId`; slices added together form one separation. */
export function addChildSamples(
  design: Design,
  parentId: string,
  samples: Sample[],
  part: Part,
): Design | undefined {
  const added = unplaced(design, samples);
  if (added.length === 0) {
    return undefined;
  }
  const from = sliceFrom(parentId, part, freeSplitOf(design, parentId));
  return {
    materials: [...design.materials, ...added.map((sample) => sampleMaterial(sample, from))],
  };
}

/** Adds samples as parents of `childId`; several parents make a merge. */
export function addParentSamples(
  design: Design,
  childId: string,
  samples: Sample[],
  part: Part,
): Design | undefined {
  const child = findMaterial(design, childId);
  const added = unplaced(design, samples);
  if (child === undefined || added.length === 0) {
    return undefined;
  }
  const parents = [
    ...(child.from === undefined ? [] : parentsOf(child.from)),
    ...added.map((sample) => sample.id),
  ];
  const of = parents.length === 1 ? parents[0] : parents;
  const from =
    child.from === undefined
      ? sliceFrom(of, part, freeSplitOf(design, parents[0]))
      : { ...child.from, of };
  const index = design.materials.indexOf(child);
  const withChild = update(design, childId, (material) => ({ ...material, from }));
  return {
    materials: withChild.materials.toSpliced(
      index,
      0,
      ...added.map((sample) => sampleMaterial(sample)),
    ),
  };
}

/** Adds samples as starting materials. */
export function addStartSamples(design: Design, samples: Sample[]): Design | undefined {
  const added = unplaced(design, samples);
  if (added.length === 0) {
    return undefined;
  }
  return { materials: [...design.materials, ...added.map((sample) => sampleMaterial(sample))] };
}

/** Puts a sample in the place of material `id`; it keeps every connection. */
export function replaceWithSample(design: Design, id: string, sample: Sample): Design | undefined {
  if (findMaterial(design, id) === undefined || findMaterial(design, sample.id) !== undefined) {
    return undefined;
  }
  return update(renameMaterial(design, id, sample.id), sample.id, (material) =>
    sampleMaterial(sample, material.from),
  );
}

/** Removes a material; its children take its parents instead, each keeping how it was made. */
export function deleteMaterial(design: Design, id: string): Design {
  const from = findMaterial(design, id)?.from;
  const grandparents = from === undefined ? [] : parentsOf(from);
  const rest = { materials: design.materials.filter((material) => material.id !== id) };
  return rest.materials.reduce(
    (state, child) => {
      const childFrom = child.from;
      if (childFrom === undefined || !parentsOf(childFrom).includes(id)) {
        return state;
      }
      const parents = Array.from(
        new Set(
          parentsOf(childFrom).flatMap((parent) => (parent === id ? grandparents : [parent])),
        ),
      );
      if (parents.length === 0) {
        return {
          ...state,
          design: update(state.design, child.id, ({ from: _from, ...root }) => root),
        };
      }
      const group = singleParent(child) === id ? JSON.stringify([childFrom.split]) : child.id;
      const split = state.splits.get(group) ?? freeSplitOf(state.design, parents[0]);
      const next: MaterialFrom = {
        of: parents.length === 1 ? parents[0] : parents,
        part: childFrom.part,
        ...(childFrom.part === "slice" && { split }),
        ...(childFrom.step !== undefined && { step: childFrom.step }),
      };
      return {
        design: update(state.design, child.id, (material) => ({ ...material, from: next })),
        splits:
          childFrom.part === "slice" ? new Map([...state.splits, [group, split]]) : state.splits,
      };
    },
    { design: rest, splits: new Map<string, string>() },
  ).design;
}

/** Removes a graph node: deletes a material, keeps only the first parent of a merge, or dissolves a split into separate steps. */
export function removeNode(design: Design, graph: Graph, id: string): Design | undefined {
  const kind = graph.nodes.find((node) => node.id === id)?.kind;
  if (kind === "material") {
    return deleteMaterial(design, id);
  }
  if (kind === "junction") {
    return junctionOf(graph, id)?.partitions.reduce(leaveSplit, design);
  }
  if (kind !== "pool") {
    return undefined;
  }
  const childId = graph.edges.find((edge) => edge.from === id)?.to;
  if (childId === undefined) {
    return undefined;
  }
  const from = findMaterial(design, childId)?.from;
  if (from === undefined) {
    return undefined;
  }
  const [first] = parentsOf(from);
  return updateFrom(design, childId, (current) => ({
    ...current,
    of: first,
    ...(current.part === "slice" && { split: freeSplitOf(design, first) }),
  }));
}

/** Adds a shadow step under each of `parentIds`. */
export function addStepsTo(design: Design, parentIds: string[]): Design {
  return parentIds.reduce((current, parentId) => addStep(current, parentId).design, design);
}

/** Sets the connection type of how each of `ids` was made. */
export function setPartOf(design: Design, ids: string[], part: Part): Design {
  return ids.reduce((current, id) => setPart(current, id, part), design);
}

/** Adds one shadow material made from all of `parentIds`: a merge. */
export function mergeInto(
  design: Design,
  parentIds: string[],
  part: Part,
): { design: Design; id: string } | undefined {
  if (parentIds.length < 2) {
    return undefined;
  }
  const id = shadowId(design);
  const merged = shadow(id, sliceFrom(parentIds, part, freeSplitOf(design, parentIds[0])));
  return { design: { materials: [...design.materials, merged] }, id };
}

/** Makes materials made from one parent the partitions of one split: the split of the first selected slice, or a new one. */
export function makeSplit(design: Design, ids: string[]): Design | undefined {
  const froms = ids.map((id) => findMaterial(design, id)?.from);
  const parents = new Set(ids.map((id) => singleParent(findMaterial(design, id))));
  const [parent] = parents;
  const splits = new Set(
    froms.map((from, index) =>
      JSON.stringify(from?.part === "slice" ? [from.split] : [null, ids[index]]),
    ),
  );
  if (ids.length < 2 || parents.size !== 1 || parent === undefined || splits.size === 1) {
    return undefined;
  }
  const split = froms.find((from) => from?.part === "slice")?.split ?? freeSplitOf(design, parent);
  return ids.reduce(
    (current, id) => updateFrom(current, id, (from) => ({ ...from, part: "slice", split })),
    design,
  );
}

/** Moves materials under one new parent; each keeps how it was made, and partitions of one split stay together. */
export function moveUnder(design: Design, ids: string[], parentId: string): Design | undefined {
  if (
    ids.length === 0 ||
    findMaterial(design, parentId) === undefined ||
    ids.some((id) => reaches(design, id, parentId))
  ) {
    return undefined;
  }
  return ids.reduce(
    (state, id) => {
      const material = findMaterial(state.design, id);
      const from = material?.from;
      const part = from?.part ?? "whole";
      const group = JSON.stringify([singleParent(material) ?? id, from?.split ?? id]);
      const split = state.splits.get(group) ?? freeSplitOf(state.design, parentId);
      const next: MaterialFrom = {
        of: parentId,
        part,
        ...(part === "slice" && { split }),
        ...(from?.step !== undefined && { step: from.step }),
      };
      return {
        design: update(state.design, id, (material) => ({ ...material, from: next })),
        splits: part === "slice" ? new Map([...state.splits, [group, split]]) : state.splits,
      };
    },
    { design, splits: new Map<string, string>() },
  ).design;
}
