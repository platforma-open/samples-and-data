import { DataModelBuilder } from '@platforma-sdk/model';
import type {
  BarcodeRule,
  BlockDataV20260427,
  BlockDataV20260428,
  DSAny,
  DSContentMultiplexedFastq,
  LegacyBlockArgs,
  LegacyBlockUiState,
  PlId,
} from './args';
import { makeRuleId } from './args';

/**
 * Walk every MultiplexedFastq dataset and:
 *   - fill `barcodeTags` / `barcodeRules` defaults if missing,
 *   - if the project has a metadata column labelled "Barcode ID" AND the
 *     dataset has no rules yet, lift it into a single-tag rule set.
 *
 * The legacy `Barcode ID` metadata column is intentionally left in place so
 * other consumers that still read it keep working until they migrate.
 */
function upgradeMultiplexedDatasets(prev: BlockDataV20260427): BlockDataV20260428 {
  const barcodeIdColumn = prev.metadata.find(
    (col) => col.label === 'Barcode ID' && col.valueType === 'String',
  );

  const datasets: DSAny[] = prev.datasets.map((ds) => {
    if (ds.content.type !== 'MultiplexedFastq') return ds;

    const c = ds.content as DSContentMultiplexedFastq & {
      barcodeTags?: string[];
      barcodeRules?: BarcodeRule[];
    };

    if (Array.isArray(c.barcodeTags) && Array.isArray(c.barcodeRules)) {
      return ds;
    }

    let barcodeTags: string[] = c.barcodeTags ?? [];
    let barcodeRules: BarcodeRule[] = c.barcodeRules ?? [];

    if (barcodeRules.length === 0 && barcodeIdColumn && c.sampleGroups) {
      const seeded: BarcodeRule[] = [];
      for (const [groupId, sampleMap] of Object.entries(c.sampleGroups)) {
        for (const sampleId of Object.keys(sampleMap)) {
          const value = barcodeIdColumn.data[sampleId as PlId];
          if (value === undefined || value === null || String(value).length === 0) continue;
          seeded.push({
            ruleId: makeRuleId(),
            sampleGroupId: groupId as PlId,
            sampleId: sampleId as PlId,
            barcodes: { BarcodeID: String(value) },
          });
        }
      }
      if (seeded.length > 0) {
        barcodeTags = barcodeTags.length > 0 ? barcodeTags : ['BarcodeID'];
        barcodeRules = seeded;
      }
    }

    return {
      ...ds,
      content: {
        ...c,
        barcodeTags,
        barcodeRules,
      },
    };
  });

  return { ...prev, datasets };
}

export const blockDataModel = new DataModelBuilder()
  .from<BlockDataV20260427>('V20260427')
  .upgradeLegacy<LegacyBlockArgs, LegacyBlockUiState>(({ args, uiState }) => ({
    ...args,
    suggestedImport: uiState?.suggestedImport ?? false,
  }))
  .migrate<BlockDataV20260428>('V20260428', upgradeMultiplexedDatasets)
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
