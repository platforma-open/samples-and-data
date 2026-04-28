---
"@platforma-open/milaboratories.samples-and-data": minor
"@platforma-open/milaboratories.samples-and-data.workflow": minor
"@platforma-open/milaboratories.samples-and-data.model": minor
"@platforma-open/milaboratories.samples-and-data.ui": minor
---

Add per-sample Multiplexing Rules to MultiplexedFastq datasets.

- **New schema fields** on `DSContentMultiplexedFastq`: `barcodeTags: string[]` (user-declared tag names) and `barcodeRules: BarcodeRule[]` (flat per-sample rules carrying one or more `(tagName -> barcode)` records). Same `(sampleGroupId, sampleId)` pair may appear in multiple rules — those entries represent per-sample alternatives.
- **New workflow column** `pl7.app/sequencing/multiplexingRules`, axes `[sampleGroupId, sampleId]`, value = JSON-encoded `Array<Record<TagName, Barcode>>`. Annotations: `pl7.app/sequencing/barcodeTags` (JSON array of declared tags) and `pl7.app/sequencing/barcodeNucleotidesOnly` (auto-detected from cell values). Replaces the legacy `pl7.app/sequencing/data/sampleGroups` linker — group membership is now derivable from the cell key set, group display name lives in the existing `pl7.app/label` column on `[sampleGroupId]`. Downstream consumers (Demultiplex FASTQ, Miltenyi clonotyping) must adopt the new column.
- **DataModelBuilder migration** to `V20260428`: walks every MultiplexedFastq dataset and fills `barcodeTags` / `barcodeRules` defaults. When a project carries a metadata column labelled "Barcode ID", the migration lifts it into a single-tag rule set (`barcodeTags = ["BarcodeID"]`) seeded from `sampleGroups × metadata.data[sampleId]`. The metadata column is left in place.
- **UI** — new Multiplexing Rules section on the MultiplexedFastq dataset page: tag declaration row (validates `[A-Za-z0-9]+`, auto-reconciles rule keys on add / rename / remove) and a flat rules table (sample-group dropdown, sample dropdown via `getOrCreateSample`, one column per declared tag, remove-row button, "+ Add rule"). Empty barcode cells show a placeholder hint and red-highlight as a hard error; non-nucleotide values show a soft warning.
- **Samplesheet import** — `ImportSamplesheetDialog` now renders one column-picker dropdown per declared barcode tag instead of the single "Barcode ID" picker. Each imported row becomes one `BarcodeRule` (with `barcodes[tag] = row[selectedColumn]` per tag). When the dataset has no tags declared yet, the dialog blocks import with a "Declare tags first" prompt.
