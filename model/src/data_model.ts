import { DataModelBuilder } from '@platforma-sdk/model';
import type {
  BlockDataV20260427,
  LegacyBlockArgs,
  LegacyBlockUiState,
} from './args';

export const blockDataModel = new DataModelBuilder()
  .from<BlockDataV20260427>('V20260427')
  .upgradeLegacy<LegacyBlockArgs, LegacyBlockUiState>(({ args, uiState }) => ({
    ...args,
    suggestedImport: uiState?.suggestedImport ?? false,
  }))
  .init(() => ({
    datasets: [],
    metadata: [],
    sampleIds: [],
    sampleLabelColumnLabel: 'Sample',
    sampleLabels: {},
    h5adFilesToPreprocess: [],
    seuratFilesToPreprocess: [],
    metadataUploadHandle: undefined,
    suggestedImport: false,
  }));
