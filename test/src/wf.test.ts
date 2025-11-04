import type { BlockArgs } from '@platforma-open/milaboratories.samples-and-data.model';
import { uniquePlId } from '@platforma-sdk/model';
import { blockTest } from '@platforma-sdk/test';
import { blockSpec } from 'this-block';

blockTest('empty inputs', { timeout: 6000 }, async ({ rawPrj: project, ml, helpers, expect }) => {
  const blockId = await project.addBlock('Block', blockSpec);
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  console.dir(await blockState.getValue(), { depth: 5 });
  const stableState = await blockState.awaitStableValue();
  expect(stableState.outputs).toStrictEqual({ fileImports: { ok: true, value: {} }, sampleGroups: { ok: true, value: { } }, availableColumns: { ok: true, value: {} } });
});

blockTest('simple input', async ({ rawPrj: project, ml, helpers, expect }) => {
  const blockId = await project.addBlock('Block', blockSpec);
  const sample1Id = uniquePlId();
  const metaColumn1Id = uniquePlId();
  const dataset1Id = uniquePlId();

  const r1Handle = await helpers.getLocalFileHandle('./assets/small_data_R1.fastq.gz');
  const r2Handle = await helpers.getLocalFileHandle('./assets/small_data_R2.fastq.gz');

  await project.setBlockArgs(blockId, {
    metadata: [
      {
        id: metaColumn1Id,
        label: 'MetaColumn1',
        global: false,
        valueType: 'Long',
        data: {
          [sample1Id]: 2345,
        },
      },
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
              R2: r2Handle,
            },
          },
        },
      },
    ],
  } satisfies BlockArgs);
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  const stableState = await blockState.awaitStableValue();

  expect(stableState.outputs).toMatchObject({
    fileImports: { ok: true, value: { [r1Handle]: { done: true }, [r2Handle]: { done: true } } },
    sampleGroups: { ok: true, value: { } },
  });
});

blockTest('simple multilane input', async ({ rawPrj: project, ml, helpers, expect }) => {
  const blockId = await project.addBlock('Block', blockSpec);
  const sample1Id = uniquePlId();
  const metaColumn1Id = uniquePlId();
  const dataset1Id = uniquePlId();

  const r1Handle = await helpers.getLocalFileHandle('./assets/small_data_R1.fastq.gz');
  const r2Handle = await helpers.getLocalFileHandle('./assets/small_data_R2.fastq.gz');

  await project.setBlockArgs(blockId, {
    metadata: [
      {
        id: metaColumn1Id,
        label: 'MetaColumn1',
        global: false,
        valueType: 'Long',
        data: {
          [sample1Id]: 2345,
        },
      },
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
                R2: r2Handle,
              },
            },
          },
        },
      },
    ],
  } satisfies BlockArgs);
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  const stableState = await blockState.awaitStableValue();

  expect(stableState.outputs).toMatchObject({
    fileImports: { ok: true, value: { [r1Handle]: { done: true }, [r2Handle]: { done: true } } },
    sampleGroups: { ok: true, value: { } },
  });
});

blockTest('multisample h5ad input', async ({ rawPrj: project, ml: _ml, helpers, expect }) => {
  const blockId = await project.addBlock('Block', blockSpec);
  const sample1Id = uniquePlId();
  const sample2Id = uniquePlId();
  const dataset1Id = uniquePlId();
  const group1Id = uniquePlId();

  const h5adHandle = await helpers.getLocalFileHandle('./assets/test.h5ad');

  await project.setBlockArgs(blockId, {
    metadata: [],
    sampleIds: [sample1Id, sample2Id],
    sampleLabelColumnLabel: 'Sample Name',
    sampleLabels: {
      [sample1Id]: 'Sample 1',
      [sample2Id]: 'Sample 2',
    },
    datasets: [
      {
        id: dataset1Id,
        label: 'H5AD Dataset',
        content: {
          type: 'MultiSampleH5AD',
          sampleColumnName: 'samples',
          gzipped: false,
          data: {
            [group1Id]: h5adHandle,
          },
          sampleGroups: {
            [group1Id]: {
              [sample1Id]: 's1',
              [sample2Id]: 's2',
            },
          },
          groupLabels: {
            [group1Id]: 'Group 1',
          },
        },
      },
    ],
    h5adFilesToPreprocess: [],
  } satisfies BlockArgs);
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  const stableState = await blockState.awaitStableValue();

  expect(stableState.outputs).toMatchObject({
    fileImports: { ok: true, value: { [h5adHandle]: { done: true } } },
    sampleGroups: { ok: true, value: { [dataset1Id]: { ok: true } } },
  });
});
