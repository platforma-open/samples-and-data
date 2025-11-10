import type {
  ImportFileHandle,
  InferHrefType,
  PlId,
  TreeNodeAccessor,
} from '@platforma-sdk/model';
import {
  BlockModel,
  type InferOutputsType,
} from '@platforma-sdk/model';
import { isGroupedDataset, type BlockArgs } from './args';

export type BlockUiState = { suggestedImport: boolean };

export const platforma = BlockModel.create()

  .withArgs<BlockArgs>({
    blockTitle: 'Samples & Data',
    sampleIds: [],
    metadata: [],
    sampleLabelColumnLabel: 'Sample',
    sampleLabels: {},
    datasets: [],
    h5adFilesToPreprocess: [],
    seuratFilesToPreprocess: [],
  })

  .withUiState<BlockUiState>({ suggestedImport: false })

  .argsValid((ctx) => ctx.args.datasets.every((ds) => {
    if (!isGroupedDataset(ds))
      return true;
    // samples are saved for each group
    return Object.keys(ds.content.sampleGroups ?? {}).length === Object.keys(ds.content.data).length;
  }))

  .output(
    'fileImports',
    (ctx) => {
      const getImports = (resolver?: TreeNodeAccessor) =>
        Object.fromEntries(
          resolver
            ?.resolve({ field: 'fileImports', assertFieldType: 'Input' })
            ?.mapFields(
              (handle, acc) => [handle as ImportFileHandle, acc.getImportProgress()],
              { skipUnresolved: true },
            ) ?? [],
        );

      return {
        ...getImports(ctx.outputs),
        ...getImports(ctx.prerun),
      };
    },
    { retentive: true, isActive: true },
  )

  .retentiveOutput(
    'sampleGroups',
    (ctx) => {
      return Object.fromEntries(ctx.prerun
        ?.resolve({ field: 'sampleGroups', assertFieldType: 'Input' })
        ?.mapFields((datasetId, groups) => {
          const dataset = ctx.args.datasets.find(ds => ds.id === datasetId);
          if (!dataset) return [datasetId as PlId, undefined];
          
          // BulkCountMatrix uses JSON objects
          if (dataset.content.type === 'BulkCountMatrix') {
            const result = Object.fromEntries(groups?.mapFields((groupId, samples) => [
              groupId as PlId, samples?.getDataAsJson<PlId[]>()]) ?? []);
            return [datasetId as PlId, result];
          } 
          // MultiSampleH5AD and MultiSampleSeurat use file handles
          else if (dataset.content.type === 'MultiSampleH5AD' || dataset.content.type === 'MultiSampleSeurat') {
            const result = Object.fromEntries(groups?.mapFields((groupId, samplesFile) => [
              groupId as PlId, samplesFile?.getFileHandle()]) ?? []);
            return [datasetId as PlId, result];
          }
          
          return [datasetId as PlId, undefined];
        }) ?? []);
    },
  )

  .retentiveOutput(
    'availableColumns',
    (ctx) => {
      return Object.fromEntries(ctx.prerun
        ?.resolve({ field: 'availableColumns', assertFieldType: 'Input' })
        ?.mapFields((fileName, columnsCsv) =>
          [fileName, columnsCsv?.getRemoteFileHandle() ?? undefined]) ?? []);
    },
  )

  .title((ctx) => ctx.args.blockTitle ?? 'Samples & Data')

  .sections((ctx) => {
    return [
      { type: 'link', href: '/', label: 'Metadata' },
      ...ctx.args.datasets.map(
        (ds) =>
          ({
            type: 'link',
            href: `/dataset?id=${ds.id}`,
            label: ds.label,
          } as const),
      ),
      {
        type: 'link',
        href: '/new-dataset',
        appearance: 'add-section',
        label: 'New Dataset',
      },
    ];
  })

  .done(2);

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './args';
