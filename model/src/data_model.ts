import { DataModelBuilder } from '@platforma-sdk/model';
import type {
  BlockDataV20260219,
  LegacyBlockArgs,
  LegacyBlockUiState,
} from './args';

export const blockDataModel = new DataModelBuilder()
  .from<BlockDataV20260219>('V20260219')
  .upgradeLegacy<LegacyBlockArgs, LegacyBlockUiState>(({ args, uiState }) => ({
    ...args,
    suggestedImport: uiState?.suggestedImport ?? false,
  }))
  .init(() => ({
    datasets: [],
    h5adFilesToPreprocess: [],
    metadata: [],
    sampleIds: [],
    sampleLabelColumnLabel: 'Sample',
    sampleLabels: {},
    seuratFilesToPreprocess: [],
    suggestedImport: false,
  }));
