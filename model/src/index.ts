import {
  MainOutputs,
  BlockModel,
  getResourceField,
  getImportProgress,
  type InferOutputsType,
  mapResourceFields,
  It
} from '@milaboratory/sdk-ui';
import { BlockArgs } from './args';

export const platforma = BlockModel.create<BlockArgs>('Heavy')

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

  .sections((ctx) => {
    return [
      { type: 'link', href: '/', label: 'Samples & Metadata' },
      ...ctx.args.datasets.map(
        (ds) =>
          ({
            type: 'link',
            href: `/dataset/${ds.id}`,
            label: ds.label
          } as const)
      ),
      { type: 'link', href: `/add-dataset`, label: '+ add dataset' }
    ];
  })

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export { BlockArgs };
export * from './helpers';
