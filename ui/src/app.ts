import {
  BlockArgs,
  BlockOutputs,
  platforma,
} from "@milaboratory/milaboratories.samples-and-data.model";
import { defineApp } from "@milaboratory/sdk-vue";
import MainPage from "./MainPage.vue";

export const sdkPlugin = defineApp<BlockArgs, BlockOutputs>(platforma, () => {
  return {
    routes: {
      "/": MainPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
