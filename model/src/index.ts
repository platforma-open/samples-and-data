import {
  BlockModel,
  getImportProgress,
  getResourceField,
  InferHrefType,
  type InferOutputsType,
  It,
  MainOutputs,
  mapResourceFields
} from '@platforma-sdk/model';
import { BlockArgs } from './args';

export type BlockUiState = { suggestedImport: boolean };

export const platforma = BlockModel.create<BlockArgs, BlockUiState>()

  .initialArgs({
    sampleIds: [],
    metadata: [],
    sampleLabelColumnLabel: 'Sample',
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
      { type: 'link', href: '/', label: 'Metadata' },
      ...ctx.args.datasets.map(
        (ds) =>
          ({
            type: 'link',
            href: `/dataset?id=${ds.id}`,
            label: ds.label
          } as const)
      )
    ];
  })

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './args';
export * from './helpers';
export { BlockArgs };

