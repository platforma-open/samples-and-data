import type { BlockArgs } from '@platforma-open/milaboratories.samples-and-data.model';
import { uniquePlId } from '@platforma-sdk/model';
import { blockTest } from '@platforma-sdk/test';
import { blockSpec } from 'this-block';

blockTest('empty inputs', { timeout: 7000 }, async ({ rawPrj: project, ml, helpers, expect }) => {
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
    h5adFilesToPreprocess: [],
    seuratFilesToPreprocess: [],
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

blockTest('multisample h5ad input', { timeout: 70000 }, async ({ rawPrj: project, ml: _ml, helpers, expect }) => {
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
    h5adFilesToPreprocess: [h5adHandle],
  } satisfies BlockArgs);
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  const stableState = await blockState.awaitStableValue();

  expect(stableState.outputs).toMatchObject({
    fileImports: { ok: true, value: { [h5adHandle]: { done: true } } },
  });

  expect(stableState.outputs?.sampleGroups?.ok).toBe(true);
  if (stableState.outputs?.sampleGroups?.ok) {
    const sampleGroupsValue = stableState.outputs.sampleGroups.value as
      Record<string, Record<string, { handle: string; size: number }>>;
    expect(sampleGroupsValue).toBeDefined();
    expect(sampleGroupsValue[dataset1Id]).toBeDefined();
    expect(sampleGroupsValue[dataset1Id][group1Id]).toBeDefined();
  }
});

blockTest('multisample seurat input', { timeout: 30000 }, async ({ rawPrj: project, ml: _ml, helpers, expect }) => {
  const blockId = await project.addBlock('Block', blockSpec);
  const sample1Id = uniquePlId();
  const sample2Id = uniquePlId();
  const dataset1Id = uniquePlId();
  const group1Id = uniquePlId();

  // TODO: Add test.rds file to assets directory
  const seuratHandle = await helpers.getLocalFileHandle('./assets/test.rds');

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
        label: 'Seurat Dataset',
        content: {
          type: 'MultiSampleSeurat',
          sampleColumnName: 'samples',
          gzipped: false,
          data: {
            [group1Id]: seuratHandle,
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
    seuratFilesToPreprocess: [],
  } satisfies BlockArgs);
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  const stableState = await blockState.awaitStableValue();

  expect(stableState.outputs).toMatchObject({
    fileImports: { ok: true, value: { [seuratHandle]: { done: true } } },
  });

  expect(stableState.outputs?.sampleGroups?.ok).toBe(true);
  if (stableState.outputs?.sampleGroups?.ok) {
    const sampleGroupsValue = stableState.outputs.sampleGroups.value as
      Record<string, Record<string, { handle: string; size: number }>>;
    expect(sampleGroupsValue).toBeDefined();
    expect(sampleGroupsValue[dataset1Id]).toBeDefined();
    expect(sampleGroupsValue[dataset1Id][group1Id]).toBeDefined();
  }
});

blockTest('simple multiplexed fastq input', async ({ rawPrj: project, ml: _ml, helpers, expect }) => {
  const blockId = await project.addBlock('Block', blockSpec);
  const sample1Id = uniquePlId();
  const sample2Id = uniquePlId();
  const metaColumn1Id = uniquePlId();
  const dataset1Id = uniquePlId();
  const group1Id = uniquePlId();

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
          [sample2Id]: 3456,
        },
      },
    ],
    sampleIds: [sample1Id, sample2Id],
    sampleLabelColumnLabel: 'Sample Name',
    sampleLabels: {
      [sample1Id]: 'Sample 1',
      [sample2Id]: 'Sample 2',
    },
    datasets: [
      {
        id: dataset1Id,
        label: 'Dataset 1',
        content: {
          type: 'MultiplexedFastq',
          readIndices: ['R1', 'R2'],
          gzipped: true,
          groupLabels: {
            [group1Id]: 'Group 1',
          },
          sampleGroups: {
            [group1Id]: {
              [sample1Id]: 'sample1',
              [sample2Id]: 'sample2',
            },
          },
          data: {
            [group1Id]: {
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
