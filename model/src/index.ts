import {
  BlockModel,
  ImportFileHandle,
  InferHrefType,
  type InferOutputsType
} from '@platforma-sdk/model';
import { BlockArgs } from './args';

export type BlockUiState = { suggestedImport: boolean };

export const platforma = BlockModel.create()

  .withArgs<BlockArgs>({
    blockTitle: 'Samples & Data',
    sampleIds: [],
    metadata: [],
    sampleLabelColumnLabel: 'Sample',
    sampleLabels: {},
    datasets: []
  })

  .withUiState<BlockUiState>({ suggestedImport: false })

  .output(
    'fileImports',
    (ctx) =>
      Object.fromEntries(
        ctx.outputs
          ?.resolve({ field: 'fileImports', assertFieldType: 'Input' })
          ?.mapFields((handle, acc) => [handle as ImportFileHandle, acc.getImportProgress()], {
            skipUnresolved: true
          }) ?? []
      ),
    { isActive: true }
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
            label: ds.label
          } as const)
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
export * from './helpers';
export { BlockArgs };
