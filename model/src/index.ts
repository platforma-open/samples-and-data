import {
  MainOutputs,
  BlockModel,
  getResourceField,
  getImportProgress,
  type InferOutputsType,
  mapResourceFields,
  It,
  InferHrefType
} from '@platforma-sdk/model';
import { BlockArgs } from './args';

export type BlockUiState = { suggestedImport: boolean };

export const platforma = BlockModel.create<BlockArgs, BlockUiState>('Heavy')

  .initialArgs({
    sampleIds: [],
    metadata: [],
    sampleLabelColumnLabel: 'Sample Name',
    sampleLabels: {},
    datasets: []
  })

  .output(
    'fileImports',
    mapResourceFields(getResourceField(MainOutputs, 'fileImports'), getImportProgress(It))
  )

  // .output('exports', (ctx) => {
  //   const ex = ctx.outputs?.resolve('exports');
  //   if (ex === undefined) return undefined;
  //   return ex.listInputFields().flatMap((f) => ex.resolve(f)?.listInputFields());
  // })

  .sections((ctx) => {
    return [
      { type: 'link', href: '/', label: 'Samples & Metadata' },
      ...ctx.args.datasets.map(
        (ds) =>
          ({
            type: 'link',
            href: `/dataset?id=${ds.id}`,
            label: ds.label
          } as const)
      ),
      { type: 'link', href: `/import-files`, label: 'Import Files' }
    ];
  })

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export { BlockArgs };
export * from './helpers';
export * from './args';
