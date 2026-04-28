---
"@platforma-open/milaboratories.samples-and-data.model": minor
"@platforma-open/milaboratories.samples-and-data.ui": minor
"@platforma-open/milaboratories.samples-and-data": minor
---

Migrate to BlockModelV3. Unified `BlockData`; three projection channels — `args` (datasets, metadata, sampleLabels, sampleLabelColumnLabel), `prerunArgs` (datasets, file-handle preprocessing arrays, metadata upload handle), data-only (sampleIds, suggestedImport). Persisted state preserved via `DataModelBuilder.upgradeLegacy`. UI bindings move to `app.model.data`.
