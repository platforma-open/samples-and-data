import {
  MainOutputs,
  PlatformaConfiguration,
  getBlobContentAsString,
  getImmediate,
  getResourceField,
  getImportProgress,
  type InferOutputsType,
} from "@milaboratory/sdk-ui";

export type BlockArgs = {
  fileHandle?: string;
};

export const platforma = PlatformaConfiguration.create<BlockArgs>("Heavy")

  .initialArgs({})

  .output("file", getBlobContentAsString(getResourceField(MainOutputs, "file")))

  .output(
    "progress",
    getImportProgress(getResourceField(MainOutputs, "progress"))
  )

  .sections(getImmediate([{ type: "link", href: "/main", label: "Main" }]))

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
