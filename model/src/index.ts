import { kind } from "@platforma-open/milaboratories.samples-and-data.kind";
import type { ImportFileHandle, InferHrefType, InferOutputsType, PlId } from "@platforma-sdk/model";
import { BlockModelV3 } from "@platforma-sdk/model";
import type { BlockArgs, BlockPrerunArgs } from "./args";
import { designLabel } from "./args";
import { blockArgsIssues } from "./args_issues";
import { blockDataModel } from "./data_model";
import { designTensorCells } from "./design_tensors";
import { deriveTemplateParams } from "./template_params";

function sortedById<T extends { id: string }>(items: T[]) {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function sortedStr<S extends string>(items: S[]): S[] {
  return [...items].sort();
}

export const platforma = BlockModelV3.create({ dataModel: blockDataModel, kind })

  .args<BlockArgs>((data) => {
    return {
      datasets: sortedById(data.datasets),
      metadata: sortedById(data.metadata),
      sampleLabelColumnLabel: data.sampleLabelColumnLabel,
      sampleLabels: data.sampleLabels,
      designTensors: designTensorCells(data.designs ?? [], data),
    };
  })

  .argsIssues(({ data }) => blockArgsIssues(data))

  .prerunArgs((data): BlockPrerunArgs => {
    return {
      datasets: sortedById(data.datasets),
      h5adFilesToPreprocess: sortedStr(data.h5adFilesToPreprocess),
      seuratFilesToPreprocess: sortedStr(data.seuratFilesToPreprocess),
      xsvFilesToPreprocess: [...data.xsvFilesToPreprocess].sort((a, b) =>
        a.file.localeCompare(b.file),
      ),
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

          if (
            dataset.content.type === "BulkCountMatrix" ||
            dataset.content.type === "MultiSampleXsv"
          ) {
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

  // Header columns of each queued CSV/TSV file, keyed by its import handle (Multisample CSV/TSV)
  .retentiveOutput("availableXsvColumns", (ctx) => {
    return Object.fromEntries(
      ctx.prerun
        ?.resolve({ field: "xsvColumns", assertFieldType: "Input", allowPermanentAbsence: true })
        ?.mapFields((fileHandle, columns) => [
          fileHandle as ImportFileHandle,
          columns?.getDataAsJson<string[]>(),
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
      { type: "delimiter" as const },
      ...(ctx.data.designs ?? []).map((design, index) => ({
        type: "link" as const,
        href: `/design?id=${design.id}` as const,
        label: designLabel(design, index),
      })),
      {
        type: "link" as const,
        href: "/new-design" as const,
        appearance: "add-section",
        label: "New Design",
      },
    ];
  })

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from "./args";
export * from "./design_tensors";
export * from "./multiplexing-rules-validation";
export * from "./template_params";
