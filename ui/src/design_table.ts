import { deepClone } from "@milaboratories/helpers";
import type {
  BlockData,
  ExperimentDesign,
  MTColumn,
} from "@platforma-open/milaboratories.samples-and-data.model";
import type { Design, Sample } from "./design-graph/types";

/** The name and issue a design node shows when its sample is no longer in the table. */
export const removedSample = { name: "Removed sample", issue: "Deleted from Metadata." };

function sampleName(label: string | undefined) {
  if (label === undefined || label.trim() === "") {
    return "Unnamed sample";
  }
  return label;
}

function columnNames(columns: MTColumn[]) {
  const base = columns.map((column) =>
    column.label.trim() === "" ? "Unnamed column" : column.label.trim(),
  );
  return base.map((name, index) => {
    const repeat = base.slice(0, index).filter((other) => other === name).length;
    return repeat === 0 ? name : `${name} (${repeat + 1})`;
  });
}

/** The block's samples, in table order, with their labels and metadata keyed by column name. */
export function tableSamples(
  data: Pick<BlockData, "sampleIds" | "sampleLabels" | "metadata">,
): Sample[] {
  const names = columnNames(data.metadata);
  return data.sampleIds.map((id) => ({
    id,
    name: sampleName(data.sampleLabels[id]),
    meta: Object.fromEntries(
      data.metadata
        .map((column, index) => [names[index], column.data[id]] as const)
        .filter(([, value]) => value !== undefined && value !== ""),
    ),
  }));
}

/** The stored design with each sample's label and metadata taken live from the table. */
export function editorDesign(stored: ExperimentDesign | undefined, samples: Sample[]): Design {
  const byId = new Map(samples.map((sample) => [sample.id, sample]));
  return {
    materials: deepClone(stored?.materials ?? []).map((material) => {
      const sample = byId.get(material.id);
      if (!material.sequenced) {
        return { ...material, meta: {} };
      }
      if (sample === undefined) {
        return { ...material, ...removedSample, meta: {} };
      }
      return { ...material, name: sample.name, meta: sample.meta };
    }),
  };
}

/** The design as stored in the block data: sample labels and metadata stay in the table. */
export function storedDesign(design: Design): ExperimentDesign {
  return {
    materials: design.materials.map(({ meta: _meta, issue: _issue, name, ...material }) => ({
      ...material,
      ...(!material.sequenced && name !== undefined && { name }),
    })),
  };
}
