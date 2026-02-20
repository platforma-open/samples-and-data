import type {
  ImportFileHandle,
  InferHrefType,
  InferOutputsType,
  PlId,
  TreeNodeAccessor
} from '@platforma-sdk/model';
import { BlockModelV3 } from '@platforma-sdk/model';
import { isGroupedDataset, type BlockArgs, type BlockData, type DSAny } from './args';
import { blockDataModel } from './data_model';

function validateDatasets(datasets: DSAny[]) {
  const valid = datasets.every((ds) => {
    if (!isGroupedDataset(ds)) return true;
    // samples are saved for each group
    return (
      Object.keys(ds.content.sampleGroups ?? {}).length === Object.keys(ds.content.data).length
    );
  });
  if (!valid) throw new Error('Not all grouped datasets have sample groups configured');
}

function sortedById<T extends { id: string }>(items: T[]) {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

// =============================================================================
// Block Model
// =============================================================================

export const platforma = BlockModelV3.create(blockDataModel)

  .args<BlockArgs>((data) => {
    validateDatasets(data.datasets);
    return {
      datasets: sortedById(data.datasets),
      metadata: sortedById(data.metadata),
      sampleLabelColumnLabel: data.sampleLabelColumnLabel,
      sampleLabels: data.sampleLabels
    };
  })

  .prerunArgs((data: BlockData) => {
    return {
      datasets: sortedById(data.datasets),
      h5adFilesToPreprocess: [...data.h5adFilesToPreprocess].sort(),
      seuratFilesToPreprocess: [...data.seuratFilesToPreprocess].sort()
    };
  })

  .output(
    'fileImports',
    (ctx) => {
      const getImports = (resolver?: TreeNodeAccessor) =>
        Object.fromEntries(
          resolver
            ?.resolve({ field: 'fileImports', assertFieldType: 'Input' })
            ?.mapFields((handle, acc) => [handle as ImportFileHandle, acc.getImportProgress()], {
              skipUnresolved: true
            }) ?? []
        );

      return {
        ...getImports(ctx.outputs),
        ...getImports(ctx.prerun)
      };
    },
    { retentive: true, isActive: true }
  )

  .retentiveOutput('sampleGroups', (ctx) => {
    return Object.fromEntries(
      ctx.prerun
        ?.resolve({ field: 'sampleGroups', assertFieldType: 'Input' })
        ?.mapFields((datasetId, groups) => {
          const dataset = ctx.data.datasets.find((ds) => ds.id === datasetId);
          if (!dataset) return [datasetId as PlId, undefined];

          // BulkCountMatrix uses JSON objects
          if (dataset.content.type === 'BulkCountMatrix') {
            const result = Object.fromEntries(
              groups?.mapFields((groupId, samples) => [
                groupId as PlId,
                samples?.getDataAsJson<PlId[]>()
              ]) ?? []
            );
            return [datasetId as PlId, result];
          }
          // MultiSampleH5AD and MultiSampleSeurat use file handles
          else if (
            dataset.content.type === 'MultiSampleH5AD' ||
            dataset.content.type === 'MultiSampleSeurat'
          ) {
            const result = Object.fromEntries(
              groups?.mapFields((groupId, samplesFile) => [
                groupId as PlId,
                samplesFile?.getFileHandle()
              ]) ?? []
            );
            return [datasetId as PlId, result];
          }

          return [datasetId as PlId, undefined];
        }) ?? []
    );
  })

  .retentiveOutput('availableColumns', (ctx) => {
    return Object.fromEntries(
      ctx.prerun
        ?.resolve({ field: 'availableColumns', assertFieldType: 'Input' })
        ?.mapFields((fileName, columnsCsv) => [
          fileName,
          columnsCsv?.getRemoteFileHandle() ?? undefined
        ]) ?? []
    );
  })

  .title(() => 'Samples & Data')

  .subtitle((ctx) => {
    const datasetsNum = ctx.data.datasets.length;
    if (datasetsNum === 0) return 'No datasets';
    if (datasetsNum === 1) return '1 dataset';
    return `${datasetsNum} datasets`;
  })

  .sections((ctx) => {
    return [
      { type: 'link', href: '/', label: 'Metadata' },
      ...ctx.data.datasets.map(
        (ds) =>
          ({
            type: 'link',
            href: `/dataset?id=${ds.id}`,
            label: ds.label
          } as const)
      ),
      {
        type: 'link',
        href: '/new-dataset',
        appearance: 'add-section',
        label: 'New Dataset'
      }
    ];
  })

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './args';
