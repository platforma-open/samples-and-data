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
import type { WithSampleGroupsData } from './args';
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
  })

  .withUiState<BlockUiState>({ suggestedImport: false })

  .argsValid((ctx) => ctx.args.datasets.every((ds) => {
    if (!isGroupedDataset(ds))
      return true;

    const content = ds.content as WithSampleGroupsData<unknown>;

    // samples are saved for each group
    return Object.keys(content.sampleGroups ?? {}).length === Object.keys(content.data).length;
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
      const mapGroups = (groups: TreeNodeAccessor | undefined) => {
        return Object.fromEntries(groups?.mapFields((groupId, samples) => [
          groupId as PlId, samples?.getDataAsJson<PlId[]>()]) ?? []);
      };

      return Object.fromEntries(ctx.prerun
        ?.resolve({ field: 'sampleGroups', assertFieldType: 'Input' })
        ?.mapFields((datasetId, groups) => [datasetId as PlId, mapGroups(groups)]) ?? []);
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
