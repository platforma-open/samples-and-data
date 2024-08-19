import { BlockArgs, uniquePlId } from '@milaboratory/milaboratories.samples-and-data.model';
import { blockTest } from '@milaboratory/sdk-test';
import { blockSpec } from 'this-block';

blockTest('empty imputs', { timeout: 5000 }, async ({ rawPrj: project, ml, helpers, expect }) => {
  const blockId = await project.addBlock('Block', blockSpec);
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  console.dir(await blockState.getValue(), { depth: 5 });
  const stableState = await blockState.awaitStableValue();
  expect(stableState.outputs).toStrictEqual({ fileImports: { ok: true, value: {} } });
});

blockTest('simple imput', async ({ rawPrj: project, ml, helpers, expect }) => {
  const blockId = await project.addBlock('Block', blockSpec);
  const sample1Id = uniquePlId();
  const metaColumn1Id = uniquePlId();
  const dataset1Id = uniquePlId();

  const r1Handle = await helpers.getLocalFileHandle('./assets/small_data_R1.fastq.gz');
  const r2Handle = await helpers.getLocalFileHandle('./assets/small_data_R2.fastq.gz');

  project.setBlockArgs(blockId, {
    metadata: [
      {
        id: metaColumn1Id,
        label: 'MetaColumn1',
        global: false,
        valueType: 'Long',
        data: {
          [sample1Id]: 2345
        }
      }
    ],
    sampleIds: [sample1Id],
    sampleLabelColumnLabel: 'Sample Name',
    sampleLabels: { [sample1Id]: 'Sample 1' },
    datasets: [
      {
        id: dataset1Id,
        label: 'Dataset 1',
        content: {
          type: 'Fastq',
          readIndices: ['R1', 'R2'],
          gzipped: true,
          data: {
            [sample1Id]: {
              R1: r1Handle,
              R2: r2Handle
            }
          }
        }
      }
    ]
  } satisfies BlockArgs);
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  const stableState = await blockState.awaitStableValue();

  expect(stableState.outputs).toMatchObject({
    fileImports: { ok: true, value: { [r1Handle]: { done: true }, [r2Handle]: { done: true } } }
  });
});

blockTest('simple multilane imput', async ({ rawPrj: project, ml, helpers, expect }) => {
  const blockId = await project.addBlock('Block', blockSpec);
  const sample1Id = uniquePlId();
  const metaColumn1Id = uniquePlId();
  const dataset1Id = uniquePlId();

  const r1Handle = await helpers.getLocalFileHandle('./assets/small_data_R1.fastq.gz');
  const r2Handle = await helpers.getLocalFileHandle('./assets/small_data_R2.fastq.gz');

  project.setBlockArgs(blockId, {
    metadata: [
      {
        id: metaColumn1Id,
        label: 'MetaColumn1',
        global: false,
        valueType: 'Long',
        data: {
          [sample1Id]: 2345
        }
      }
    ],
    sampleIds: [sample1Id],
    sampleLabelColumnLabel: 'Sample Name',
    sampleLabels: { [sample1Id]: 'Sample 1' },
    datasets: [
      {
        id: dataset1Id,
        label: 'Dataset 1',
        content: {
          type: 'MultilaneFastq',
          readIndices: ['R1', 'R2'],
          gzipped: true,
          data: {
            [sample1Id]: {
              L001: {
                R1: r1Handle,
                R2: r2Handle
              }
            }
          }
        }
      }
    ]
  } satisfies BlockArgs);
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  const stableState = await blockState.awaitStableValue();

  expect(stableState.outputs).toMatchObject({
    fileImports: { ok: true, value: { [r1Handle]: { done: true }, [r2Handle]: { done: true } } }
  });
});
