import { kind } from "@platforma-open/milaboratories.samples-and-data.kind";
import type { ImportFileHandle, InferHrefType, InferOutputsType, PlId } from "@platforma-sdk/model";
import { BlockModelV3 } from "@platforma-sdk/model";
import { blockDataModel } from "./data_model";
import { isGroupedDataset } from "./args";
import type { BlockArgs, BlockPrerunArgs, DSAny } from "./args";
import { validateMultiplexingRules } from "./multiplexing-rules-validation";
import { deriveTemplateParams } from "./template_params";

function validateDatasets(datasets: DSAny[]) {
  // A dataset with no data is a legal editor state (it is what a project
  // template seeds), but running it would export empty columns, so it blocks
  // Run until files are added. A block with no datasets at all still runs.
  const empty = datasets.filter((ds) => Object.keys(ds.content.data).length === 0);
  if (empty.length > 0) {
    throw new Error(
      `No data in dataset${empty.length > 1 ? "s" : ""}: ${empty.map((ds) => `"${ds.label}"`).join(", ")}`,
    );
  }

  const valid = datasets.every((ds) => {
    if (!isGroupedDataset(ds)) return true;
    return (
      Object.keys(ds.content.sampleGroups ?? {}).length === Object.keys(ds.content.data).length
    );
  });
  if (!valid) throw new Error("Not all grouped datasets have sample groups configured");
}

function sortedById<T extends { id: string }>(items: T[]) {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function sortedStr<S extends string>(items: S[]): S[] {
  return [...items].sort();
}

export const platforma = BlockModelV3.create({ dataModel: blockDataModel, kind })

  .args<BlockArgs>((data) => {
    validateDatasets(data.datasets);
    const ruleIssues = validateMultiplexingRules(data.datasets, data.sampleLabels);
    if (ruleIssues.length > 0) {
      throw new Error(ruleIssues.map((i) => `${i.datasetLabel}: ${i.message}`).join(" | "));
    }
    return {
      datasets: sortedById(data.datasets),
      metadata: sortedById(data.metadata),
      sampleLabelColumnLabel: data.sampleLabelColumnLabel,
      sampleLabels: data.sampleLabels,
    };
  })

  .prerunArgs((data): BlockPrerunArgs => {
    return {
      datasets: sortedById(data.datasets),
      h5adFilesToPreprocess: sortedStr(data.h5adFilesToPreprocess),
      seuratFilesToPreprocess: sortedStr(data.seuratFilesToPreprocess),
      metadataUploadHandle: data.metadataUploadHandle,
    };
  })

  .templateParams(deriveTemplateParams)

  .output(
    "fileImports",
    (ctx) => {
      return Object.fromEntries(
        ctx.outputs
          ?.resolve({ field: "fileImports", assertFieldType: "Input" })
          ?.mapFields((handle, acc) => [handle as ImportFileHandle, acc.getImportProgress()], {
            skipUnresolved: true,
          }) ?? [],
      );
    },
    { isActive: true },
  )

  // Drives prerun file uploads; the getImportProgress() calls register with
  // the UploadDriver, triggering actual blob uploads. Without this active
  // output, prerun dependencies (sampleGroups, availableColumns) would never
  // resolve. Progress values are not used by the UI.
  .output(
    "prerunFileImports",
    (ctx) => {
      return Object.fromEntries(
        ctx.prerun
          ?.resolve({ field: "fileImports", assertFieldType: "Input" })
          ?.mapFields((handle, acc) => [handle as ImportFileHandle, acc.getImportProgress()], {
            skipUnresolved: true,
          }) ?? [],
      );
    },
    { isActive: true },
  )

  .retentiveOutput("sampleGroups", (ctx) => {
    return Object.fromEntries(
      ctx.prerun
        ?.resolve({ field: "sampleGroups", assertFieldType: "Input" })
        ?.mapFields((datasetId, groups) => {
          const dataset = ctx.data.datasets.find((ds) => ds.id === datasetId);
          if (!dataset) return [datasetId as PlId, undefined];

          if (dataset.content.type === "BulkCountMatrix") {
            const result = Object.fromEntries(
              groups?.mapFields((groupId, samples) => [
                groupId as PlId,
                samples?.getDataAsJson<PlId[]>(),
              ]) ?? [],
            );
            return [datasetId as PlId, result];
          } else if (
            dataset.content.type === "MultiSampleH5AD" ||
            dataset.content.type === "MultiSampleSeurat"
          ) {
            const result = Object.fromEntries(
              groups?.mapFields((groupId, samplesFile) => [
                groupId as PlId,
                samplesFile?.getFileHandle(),
              ]) ?? [],
            );
            return [datasetId as PlId, result];
          }

          return [datasetId as PlId, undefined];
        }) ?? [],
    );
  })

  .retentiveOutput("availableColumns", (ctx) => {
    return Object.fromEntries(
      ctx.prerun
        ?.resolve({ field: "availableColumns", assertFieldType: "Input" })
        ?.mapFields((fileName, columnsCsv) => [
          fileName,
          columnsCsv?.getRemoteFileHandle() ?? undefined,
        ]) ?? [],
    );
  })

  .retentiveOutput("metadataFile", (ctx) =>
    ctx.prerun?.traverse({ field: "metadataFile" })?.getFileHandle(),
  )

  .title(() => "Samples & Data")

  .subtitle((ctx) => {
    const datasetsNum = ctx.data.datasets.length;
    if (datasetsNum === 0) return "No datasets";
    if (datasetsNum === 1) return "1 dataset";
    return `${datasetsNum} datasets`;
  })

  .sections((ctx) => {
    return [
      { type: "link" as const, href: "/" as const, label: "Metadata" },
      ...ctx.data.datasets.map((ds) => ({
        type: "link" as const,
        href: `/dataset?id=${ds.id}` as const,
        label: ds.label,
      })),
      {
        type: "link" as const,
        href: "/new-dataset" as const,
        appearance: "add-section",
        label: "New Dataset",
      },
    ];
  })

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from "./args";
export * from "./multiplexing-rules-validation";
export * from "./template_params";
