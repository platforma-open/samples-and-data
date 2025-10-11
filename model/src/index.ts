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
import type { BlockArgs } from './args';

export type BlockUiState = { suggestedImport: boolean };

export const platforma = BlockModel.create()

  .withArgs<BlockArgs>({
    blockTitle: 'Samples & Data',
    sampleIds: [],
    metadata: [],
    sampleLabelColumnLabel: 'Sample',
    sampleLabels: {},
    groupIds: [],
    groupLabels: {},
    datasets: [],
  })

  .withUiState<BlockUiState>({ suggestedImport: false })

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
    { isActive: true },
  )

  .output(
    'sampleGroups',
    (ctx) => {
      const mapGroups = (groups: TreeNodeAccessor | undefined) => {
        return Object.fromEntries(groups?.mapFields((groupId, samples) => [
          groupId, samples?.getDataAsJson<PlId[]>()]) ?? []);
      };

      return Object.fromEntries(ctx.prerun
        ?.resolve({ field: 'sampleGroups', assertFieldType: 'Input' })
        ?.mapFields((datasetId, groups) => [datasetId, mapGroups(groups)]) ?? []);
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
