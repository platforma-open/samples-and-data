import type { BlockData } from "@platforma-open/milaboratories.samples-and-data.model";
import { uniquePlId } from "@platforma-sdk/model";
import { blockTest } from "@platforma-sdk/test";
import { SamplesAndDataBlockPointer } from "this-block";

blockTest("empty inputs", { timeout: 30000 }, async ({ rawPrj: project, helpers, expect }) => {
  const blockId = await project.addBlock("Block", SamplesAndDataBlockPointer);
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  console.dir(await blockState.getValue(), { depth: 5 });
  const stableState = await blockState.awaitStableValue();
  expect(stableState.outputs).toStrictEqual({
    fileImports: { ok: true, stable: true, value: {} },
    prerunFileImports: { ok: true, stable: true, value: {} },
    sampleGroups: { ok: true, stable: true, value: {} },
    availableColumns: { ok: true, stable: true, value: {} },
    availableXsvColumns: { ok: true, stable: true, value: {} },
    metadataFile: { ok: true, stable: true, value: undefined },
  });
});

blockTest("simple input", async ({ rawPrj: project, helpers, expect }) => {
  const blockId = await project.addBlock("Block", SamplesAndDataBlockPointer);
  const sample1Id = uniquePlId();
  const metaColumn1Id = uniquePlId();
  const dataset1Id = uniquePlId();

  const r1Handle = await helpers.getLocalFileHandle("./assets/small_data_R1.fastq.gz");
  const r2Handle = await helpers.getLocalFileHandle("./assets/small_data_R2.fastq.gz");

  await project.mutateBlockStorage(blockId, {
    operation: "update-block-data",
    value: {
      metadata: [
        {
          id: metaColumn1Id,
          label: "MetaColumn1",
          global: false,
          valueType: "Long",
          data: {
            [sample1Id]: 2345,
          },
        },
      ],
      sampleIds: [sample1Id],
      sampleLabelColumnLabel: "Sample Name",
      sampleLabels: { [sample1Id]: "Sample 1" },
      datasets: [
        {
          id: dataset1Id,
          label: "Dataset 1",
          content: {
            type: "Fastq",
            readIndices: ["R1", "R2"],
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
      h5adFilesToPreprocess: [],
      seuratFilesToPreprocess: [],
      xsvFilesToPreprocess: [],
      suggestedImport: false,
    } satisfies BlockData,
  });
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  const stableState = await blockState.awaitStableValue();

  expect(stableState.outputs).toMatchObject({
    fileImports: { ok: true, value: { [r1Handle]: { done: true }, [r2Handle]: { done: true } } },
    sampleGroups: { ok: true, value: {} },
  });
});

blockTest("simple multilane input", async ({ rawPrj: project, helpers, expect }) => {
  const blockId = await project.addBlock("Block", SamplesAndDataBlockPointer);
  const sample1Id = uniquePlId();
  const metaColumn1Id = uniquePlId();
  const dataset1Id = uniquePlId();

  const r1Handle = await helpers.getLocalFileHandle("./assets/small_data_R1.fastq.gz");
  const r2Handle = await helpers.getLocalFileHandle("./assets/small_data_R2.fastq.gz");

  await project.mutateBlockStorage(blockId, {
    operation: "update-block-data",
    value: {
      metadata: [
        {
          id: metaColumn1Id,
          label: "MetaColumn1",
          global: false,
          valueType: "Long",
          data: {
            [sample1Id]: 2345,
          },
        },
      ],
      sampleIds: [sample1Id],
      sampleLabelColumnLabel: "Sample Name",
      sampleLabels: { [sample1Id]: "Sample 1" },
      datasets: [
        {
          id: dataset1Id,
          label: "Dataset 1",
          content: {
            type: "MultilaneFastq",
            readIndices: ["R1", "R2"],
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
      xsvFilesToPreprocess: [],
      suggestedImport: false,
    } satisfies BlockData,
  });
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  const stableState = await blockState.awaitStableValue();

  expect(stableState.outputs).toMatchObject({
    fileImports: { ok: true, value: { [r1Handle]: { done: true }, [r2Handle]: { done: true } } },
    sampleGroups: { ok: true, value: {} },
  });
});

blockTest(
  "multisample h5ad input",
  { timeout: 100000 },
  async ({ rawPrj: project, ml: _ml, helpers, expect }) => {
    const blockId = await project.addBlock("Block", SamplesAndDataBlockPointer);
    const sample1Id = uniquePlId();
    const sample2Id = uniquePlId();
    const dataset1Id = uniquePlId();
    const group1Id = uniquePlId();

    const h5adHandle = await helpers.getLocalFileHandle("./assets/test.h5ad");

    await project.mutateBlockStorage(blockId, {
      operation: "update-block-data",
      value: {
        metadata: [],
        sampleIds: [sample1Id, sample2Id],
        sampleLabelColumnLabel: "Sample Name",
        sampleLabels: {
          [sample1Id]: "Sample 1",
          [sample2Id]: "Sample 2",
        },
        datasets: [
          {
            id: dataset1Id,
            label: "H5AD Dataset",
            content: {
              type: "MultiSampleH5AD",
              sampleColumnName: "samples",
              gzipped: false,
              data: {
                [group1Id]: h5adHandle,
              },
              sampleGroups: {
                [group1Id]: {
                  [sample1Id]: "s1",
                  [sample2Id]: "s2",
                },
              },
              groupLabels: {
                [group1Id]: "Group 1",
              },
            },
          },
        ],
        h5adFilesToPreprocess: [h5adHandle],
        seuratFilesToPreprocess: [],
        xsvFilesToPreprocess: [],
        suggestedImport: false,
      } satisfies BlockData,
    });
    await project.runBlock(blockId);
    await helpers.awaitBlockDone(blockId);
    const blockState = project.getBlockState(blockId);
    const stableState = await blockState.awaitStableValue();

    expect(stableState.outputs).toMatchObject({
      fileImports: { ok: true, value: { [h5adHandle]: { done: true } } },
    });

    expect(stableState.outputs?.sampleGroups?.ok).toBe(true);
    if (stableState.outputs?.sampleGroups?.ok) {
      const sampleGroupsValue = stableState.outputs.sampleGroups.value as Record<
        string,
        Record<string, { handle: string; size: number }>
      >;
      expect(sampleGroupsValue).toBeDefined();
      expect(sampleGroupsValue[dataset1Id]).toBeDefined();
      expect(sampleGroupsValue[dataset1Id][group1Id]).toBeDefined();
    }
  },
);

blockTest(
  "multisample csv/tsv input",
  { timeout: 100000 },
  async ({ rawPrj: project, helpers, expect }) => {
    const blockId = await project.addBlock("Block", SamplesAndDataBlockPointer);
    const datasetId = uniquePlId();
    const group1Id = uniquePlId();
    const group2Id = uniquePlId();
    const s1 = uniquePlId();
    const s2 = uniquePlId();
    const s3 = uniquePlId();
    const s01 = uniquePlId();
    const sOne = uniquePlId();

    // pool1: S1, S2, S3 and a row with an empty sample value; pool2: S3, "01" and "1"
    const pool1Handle = await helpers.getLocalFileHandle("./assets/multisample-pool1.tsv");
    const pool2Handle = await helpers.getLocalFileHandle("./assets/multisample-pool2.tsv");
    const csvGzHandle = await helpers.getLocalFileHandle("./assets/multisample-header.csv.gz");

    await project.mutateBlockStorage(blockId, {
      operation: "update-block-data",
      value: {
        metadata: [],
        sampleIds: [s1, s2, s3, s01, sOne],
        sampleLabelColumnLabel: "Sample Name",
        sampleLabels: { [s1]: "S1", [s2]: "S2", [s3]: "S3", [s01]: "01", [sOne]: "1" },
        datasets: [
          {
            id: datasetId,
            label: "Multisample table",
            content: {
              type: "MultiSampleXsv",
              xsvType: "tsv",
              sampleColumnName: "sample",
              gzipped: false,
              data: { [group1Id]: pool1Handle, [group2Id]: pool2Handle },
              sampleGroups: {
                [group1Id]: { [s1]: "S1", [s2]: "S2", [s3]: "S3" },
                [group2Id]: { [s3]: "S3", [s01]: "01", [sOne]: "1" },
              },
              groupLabels: { [group1Id]: "pool1", [group2Id]: "pool2" },
            },
          },
        ],
        h5adFilesToPreprocess: [],
        seuratFilesToPreprocess: [],
        xsvFilesToPreprocess: [
          { file: pool1Handle, xsvType: "tsv", gzipped: false },
          { file: csvGzHandle, xsvType: "csv", gzipped: true },
        ],
        suggestedImport: false,
      } satisfies BlockData,
    });
    await project.runBlock(blockId);
    await helpers.awaitBlockDone(blockId);
    const stableState = await project.getBlockState(blockId).awaitStableValue();

    // Distinct values per file, read as text and sorted; the empty value is skipped
    expect(stableState.outputs?.sampleGroups).toMatchObject({
      ok: true,
      value: {
        [datasetId]: {
          [group1Id]: ["S1", "S2", "S3"],
          [group2Id]: ["01", "1", "S3"],
        },
      },
    });

    // Header columns in file order, gzip-compressed CSV included
    expect(stableState.outputs?.availableXsvColumns).toMatchObject({
      ok: true,
      value: {
        [pool1Handle]: ["sample", "sequence", "count"],
        [csvGzHandle]: ["sample", "sequence", "count"],
      },
    });
  },
);

blockTest(
  "multisample seurat input",
  { timeout: 100000 },
  async ({ rawPrj: project, ml: _ml, helpers, expect }) => {
    const blockId = await project.addBlock("Block", SamplesAndDataBlockPointer);
    const sample1Id = uniquePlId();
    const sample2Id = uniquePlId();
    const dataset1Id = uniquePlId();
    const group1Id = uniquePlId();

    // TODO: Add test.rds file to assets directory
    const seuratHandle = await helpers.getLocalFileHandle("./assets/test.rds");

    await project.mutateBlockStorage(blockId, {
      operation: "update-block-data",
      value: {
        metadata: [],
        sampleIds: [sample1Id, sample2Id],
        sampleLabelColumnLabel: "Sample Name",
        sampleLabels: {
          [sample1Id]: "Sample 1",
          [sample2Id]: "Sample 2",
        },
        datasets: [
          {
            id: dataset1Id,
            label: "Seurat Dataset",
            content: {
              type: "MultiSampleSeurat",
              sampleColumnName: "sample",
              gzipped: false,
              data: {
                [group1Id]: seuratHandle,
              },
              sampleGroups: {
                [group1Id]: {
                  [sample1Id]: "s1",
                  [sample2Id]: "s2",
                },
              },
              groupLabels: {
                [group1Id]: "Group 1",
              },
            },
          },
        ],
        h5adFilesToPreprocess: [],
        seuratFilesToPreprocess: [seuratHandle],
        xsvFilesToPreprocess: [],
        suggestedImport: false,
      } satisfies BlockData,
    });
    await project.runBlock(blockId);
    await helpers.awaitBlockDone(blockId);
    const blockState = project.getBlockState(blockId);
    const stableState = await blockState.awaitStableValue();

    expect(stableState.outputs).toMatchObject({
      fileImports: { ok: true, value: { [seuratHandle]: { done: true } } },
    });

    expect(stableState.outputs?.sampleGroups?.ok).toBe(true);
    if (stableState.outputs?.sampleGroups?.ok) {
      const sampleGroupsValue = stableState.outputs.sampleGroups.value as Record<
        string,
        Record<string, { handle: string; size: number }>
      >;
      expect(sampleGroupsValue).toBeDefined();
      expect(sampleGroupsValue[dataset1Id]).toBeDefined();
      expect(sampleGroupsValue[dataset1Id][group1Id]).toBeDefined();
    }
  },
);

blockTest("simple h5 input", async ({ rawPrj: project, ml: _ml, helpers, expect }) => {
  const blockId = await project.addBlock("Block", SamplesAndDataBlockPointer);
  const sample1Id = uniquePlId();
  const dataset1Id = uniquePlId();

  // TODO: Add test.h5 file to assets directory
  const h5Handle = await helpers.getLocalFileHandle("./assets/test.h5");

  await project.mutateBlockStorage(blockId, {
    operation: "update-block-data",
    value: {
      metadata: [],
      sampleIds: [sample1Id],
      sampleLabelColumnLabel: "Sample Name",
      sampleLabels: {
        [sample1Id]: "Sample 1",
      },
      datasets: [
        {
          id: dataset1Id,
          label: "H5 Dataset",
          content: {
            type: "H5",
            gzipped: false,
            data: {
              [sample1Id]: h5Handle,
            },
          },
        },
      ],
      h5adFilesToPreprocess: [],
      seuratFilesToPreprocess: [],
      xsvFilesToPreprocess: [],
      suggestedImport: false,
    } satisfies BlockData,
  });
  await project.runBlock(blockId);
  await helpers.awaitBlockDone(blockId);
  const blockState = project.getBlockState(blockId);
  const stableState = await blockState.awaitStableValue();

  expect(stableState.outputs).toMatchObject({
    fileImports: { ok: true, value: { [h5Handle]: { done: true } } },
    sampleGroups: { ok: true, value: {} },
  });
});

blockTest(
  "simple multiplexed fastq input",
  async ({ rawPrj: project, ml: _ml, helpers, expect }) => {
    const blockId = await project.addBlock("Block", SamplesAndDataBlockPointer);
    const sample1Id = uniquePlId();
    const sample2Id = uniquePlId();
    const metaColumn1Id = uniquePlId();
    const dataset1Id = uniquePlId();
    const group1Id = uniquePlId();

    const r1Handle = await helpers.getLocalFileHandle("./assets/small_data_R1.fastq.gz");
    const r2Handle = await helpers.getLocalFileHandle("./assets/small_data_R2.fastq.gz");

    await project.mutateBlockStorage(blockId, {
      operation: "update-block-data",
      value: {
        metadata: [
          {
            id: metaColumn1Id,
            label: "MetaColumn1",
            global: false,
            valueType: "Long",
            data: {
              [sample1Id]: 2345,
              [sample2Id]: 3456,
            },
          },
        ],
        sampleIds: [sample1Id, sample2Id],
        sampleLabelColumnLabel: "Sample Name",
        sampleLabels: {
          [sample1Id]: "Sample 1",
          [sample2Id]: "Sample 2",
        },
        datasets: [
          {
            id: dataset1Id,
            label: "Dataset 1",
            content: {
              type: "MultiplexedFastq",
              readIndices: ["R1", "R2"],
              gzipped: true,
              groupLabels: {
                [group1Id]: "Group 1",
              },
              sampleGroups: {
                [group1Id]: {
                  [sample1Id]: "sample1",
                  [sample2Id]: "sample2",
                },
              },
              data: {
                [group1Id]: {
                  R1: r1Handle,
                  R2: r2Handle,
                },
              },
              barcodeTags: [],
              barcodeRules: [],
            },
          },
        ],
        h5adFilesToPreprocess: [],
        seuratFilesToPreprocess: [],
        xsvFilesToPreprocess: [],
        suggestedImport: false,
      } satisfies BlockData,
    });
    await project.runBlock(blockId);
    await helpers.awaitBlockDone(blockId);
    const blockState = project.getBlockState(blockId);
    const stableState = await blockState.awaitStableValue();

    expect(stableState.outputs).toMatchObject({
      fileImports: { ok: true, value: { [r1Handle]: { done: true }, [r2Handle]: { done: true } } },
      sampleGroups: { ok: true, value: {} },
    });
  },
);

// Regression net for the rules-present MultiplexedFastq emission path.
// PR #124's `defaultBindingsFor` changes (skip non-matching headers +
// barcode-shaped fallback) both seed datasets shaped like this one. The
// block must reach stable state with populated `barcodeRules` + `barcodeTags`
// and import both reads. Sibling test 'simple multiplexed fastq input'
// above exercises the zero-rules path.
blockTest(
  "multiplexed fastq with barcode rules",
  async ({ rawPrj: project, ml: _ml, helpers, expect }) => {
    const blockId = await project.addBlock("Block", SamplesAndDataBlockPointer);
    const sample1Id = uniquePlId();
    const sample2Id = uniquePlId();
    const metaColumn1Id = uniquePlId();
    const dataset1Id = uniquePlId();
    const group1Id = uniquePlId();

    const r1Handle = await helpers.getLocalFileHandle("./assets/small_data_R1.fastq.gz");
    const r2Handle = await helpers.getLocalFileHandle("./assets/small_data_R2.fastq.gz");

    await project.mutateBlockStorage(blockId, {
      operation: "update-block-data",
      value: {
        metadata: [
          {
            id: metaColumn1Id,
            label: "Condition",
            global: false,
            valueType: "String",
            data: {
              [sample1Id]: "Healthy",
              [sample2Id]: "Disease",
            },
          },
        ],
        sampleIds: [sample1Id, sample2Id],
        sampleLabelColumnLabel: "Sample Name",
        sampleLabels: {
          [sample1Id]: "sampleC",
          [sample2Id]: "sampleD",
        },
        datasets: [
          {
            id: dataset1Id,
            label: "Dataset 1",
            content: {
              type: "MultiplexedFastq",
              readIndices: ["R1", "R2"],
              gzipped: true,
              groupLabels: {
                [group1Id]: "Group 1",
              },
              sampleGroups: {
                [group1Id]: {
                  [sample1Id]: "sampleC",
                  [sample2Id]: "sampleD",
                },
              },
              data: {
                [group1Id]: {
                  R1: r1Handle,
                  R2: r2Handle,
                },
              },
              barcodeTags: ["BarcodeID"],
              barcodeRules: [
                {
                  ruleId: "rule-1",
                  sampleGroupId: group1Id,
                  sampleId: sample1Id,
                  barcodes: { BarcodeID: "UDP0001" },
                },
                {
                  ruleId: "rule-2",
                  sampleGroupId: group1Id,
                  sampleId: sample2Id,
                  barcodes: { BarcodeID: "UDP0002" },
                },
              ],
            },
          },
        ],
        h5adFilesToPreprocess: [],
        seuratFilesToPreprocess: [],
        xsvFilesToPreprocess: [],
        suggestedImport: false,
      } satisfies BlockData,
    });
    await project.runBlock(blockId);
    await helpers.awaitBlockDone(blockId);
    const blockState = project.getBlockState(blockId);
    const stableState = await blockState.awaitStableValue();

    // `sampleGroups.value` is `{}` for MultiplexedFastq by design — the
    // retentiveOutput in model/src/index.ts returns `undefined` for any dataset
    // type other than BulkCountMatrix / MultiSampleH5AD / MultiSampleSeurat.
    // The `ok: true` check confirms the derivation succeeded without throwing,
    // not its content. The workflow's `multiplexingRules` PColumn emission is
    // consumed by downstream blocks, not surfaced as a model output here.
    expect(stableState.outputs).toMatchObject({
      fileImports: { ok: true, value: { [r1Handle]: { done: true }, [r2Handle]: { done: true } } },
      sampleGroups: { ok: true, value: {} },
    });
  },
);
