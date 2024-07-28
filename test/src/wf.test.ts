import { blockTest } from "@milaboratory/sdk-test";
import { test } from "vitest";
import { blockSpec } from "this-block";

blockTest(
  "Run template",
  async ({ rawPrj: project, ml, helpers }) => {
    const blockId = await project.addBlock("Block", blockSpec);

    console.log("test");

    const overview = await project.overview.getValue();

    // console.dir(overview, {depth: 5});

    const blockOverview = overview?.blocks.find((b) => b.id === blockId)!;

    if (blockOverview.updatedBlockPack) {
      console.log("updated block");

      console.dir(blockOverview.updatedBlockPack, { depth: 5 });
      await project.updateBlockPack(blockId, blockOverview.updatedBlockPack!);
    }

    const f = await helpers.getLocalFileHandle("./assets/test_file.json");

    await project.setBlockArgs(blockId, { fileHandle: f });
    await project.runBlock(blockId);
    await helpers.awaitBlockDone(blockId);

    const blockState = await project.getBlockState(blockId);

    console.dir(await blockState.awaitStableValue(), { depth: 5 });
  }
);
