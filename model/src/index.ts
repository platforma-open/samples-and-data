import type {
  ImportFileHandle,
  InferHrefType,
  PlId,
} from '@platforma-sdk/model';
import {
  BlockModel,
  type InferOutputsType,
} from '@platforma-sdk/model';
import type { DatasetAny, MetadataColumn } from './types';

export type BlockArgs = {
  blockTitle?: string;
  sampleIds: PlId[];
  sampleLabelColumnLabel: string;
  sampleLabels: Record<PlId, string>;
  metadata: MetadataColumn[];
  datasets: DatasetAny[];
};

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

  .output(
    'fileImports',
    (ctx) =>
      Object.fromEntries(
        ctx.outputs
          ?.resolve({ field: 'fileImports', assertFieldType: 'Input' })
          ?.mapFields((handle, acc) => [handle as ImportFileHandle, acc.getImportProgress()], {
            skipUnresolved: true,
          }) ?? [],
      ),
    { isActive: true },
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

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './types';
export * from './util';

