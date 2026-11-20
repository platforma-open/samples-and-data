import { deepClone } from "@milaboratories/helpers";
import type {
  BlockData,
  DesignMaterial,
} from "@platforma-open/milaboratories.samples-and-data.model";
import { columnNames } from "@platforma-open/milaboratories.samples-and-data.model";
import type { Design, Sample } from "./design-graph/types";

/** The name and issue a design node shows when its sample is no longer in the table. */
export const removedSample = { name: "Removed sample", issue: "Deleted from Metadata." };

function sampleName(label: string | undefined) {
  if (label === undefined || label.trim() === "") {
    return "Unnamed sample";
  }
  return label;
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

/** The stored materials of a design with each sample's label and metadata taken live from the table. */
export function editorDesign(stored: DesignMaterial[], samples: Sample[]): Design {
  const byId = new Map(samples.map((sample) => [sample.id, sample]));
  return {
    materials: deepClone(stored).map((material) => {
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

/** The materials as stored in the block data: sample labels and metadata stay in the table. */
export function storedMaterials(design: Design): DesignMaterial[] {
  return design.materials.map(({ meta: _meta, issue: _issue, name, ...material }) => ({
    ...material,
    ...(!material.sequenced && name !== undefined && { name }),
  }));
}
