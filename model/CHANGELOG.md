# @platforma-open/milaboratories.samples-and-data.model

## 2.8.0

### Minor Changes

- 5ce12fc: Add per-sample Multiplexing Rules to MultiplexedFastq datasets.

  - **New schema fields** on `DSContentMultiplexedFastq`: `barcodeTags: string[]` (user-declared tag names) and `barcodeRules: BarcodeRule[]` (flat per-sample rules carrying one or more `(tagName -> barcode)` records). Same `(sampleGroupId, sampleId)` pair may appear in multiple rules — those entries represent per-sample alternatives.
  - **New workflow column** `pl7.app/sequencing/multiplexingRules`, axes `[sampleGroupId, sampleId]`, value = JSON-encoded `Array<Record<TagName, Barcode>>`. Annotations: `pl7.app/sequencing/barcodeTags` (JSON array of declared tags) and `pl7.app/sequencing/barcodeNucleotidesOnly` (auto-detected from cell values). Replaces the legacy `pl7.app/sequencing/data/sampleGroups` linker — group membership is now derivable from the cell key set, group display name lives in the existing `pl7.app/label` column on `[sampleGroupId]`. Downstream consumers (Demultiplex FASTQ, Miltenyi clonotyping) must adopt the new column.
  - **DataModelBuilder migration** to `V20260428`: walks every MultiplexedFastq dataset and fills `barcodeTags` / `barcodeRules` defaults. When a project carries a metadata column labelled "Barcode ID", the migration lifts it into a single-tag rule set (`barcodeTags = ["BarcodeID"]`) seeded from `sampleGroups × metadata.data[sampleId]`. The metadata column is left in place.
  - **UI** — new Multiplexing Rules section on the MultiplexedFastq dataset page: tag declaration row (validates `[A-Za-z0-9]+`, auto-reconciles rule keys on add / rename / remove) and a flat rules table (sample-group dropdown, sample dropdown via `getOrCreateSample`, one column per declared tag, remove-row button, "+ Add rule"). Empty barcode cells show a placeholder hint and red-highlight as a hard error; non-nucleotide values show a soft warning.
  - **Samplesheet import** — `ImportSamplesheetDialog` now renders one column-picker dropdown per declared barcode tag instead of the single "Barcode ID" picker. Each imported row becomes one `BarcodeRule` (with `barcodes[tag] = row[selectedColumn]` per tag). When the dataset has no tags declared yet, the dialog blocks import with a "Declare tags first" prompt.

## 2.7.0

### Minor Changes

- c8d92d5: Migrate to BlockModelV3. Unified `BlockData`; three projection channels — `args` (datasets, metadata, sampleLabels, sampleLabelColumnLabel), `prerunArgs` (datasets, file-handle preprocessing arrays, metadata upload handle), data-only (sampleIds, suggestedImport). Persisted state preserved via `DataModelBuilder.upgradeLegacy`. UI bindings move to `app.model.data`.

## 2.6.0

### Minor Changes

- d721252: Add remote metadata file import support via PlFileDialog

  Users can now select metadata files from remote storage (S3, cloud storage, etc.) in addition to local files. When a remote file is selected, the backend downloads it via the prerun and makes it available to the UI for parsing. A loading modal shows during download; once ready, the existing ImportMetadataDialog appears for sample matching and import.

## 2.5.3

### Patch Changes

- 43a5aa6: Fix upload progress reporting and block running state:
  - Split fileImports into main (with progress) and prerun (upload-only) active outputs
  - Add uploadedFiles workflow output to block on upload completion, keeping calculationStatus "Running" until done

## 2.5.2

### Patch Changes

- c130999: Revert v3 model migraion

## 2.5.1

### Patch Changes

- 1a100d0: BlockModelV3 migration

## 2.5.0

### Minor Changes

- ed17db5: Added subtitle, removed editable title

## 2.4.1

### Patch Changes

- dc479f3: technical release

## 2.4.0

### Minor Changes

- 4a2bbae: h5 file format support implemented

## 2.3.0

### Minor Changes

- ae6ef20: Seurat RDS format support

  Added support for importing Seurat objects stored in RDS format, including both single sample and multisample datasets. Users can now import Seurat datasets with one or multiple samples, with automatic sample extraction from metadata columns for multisample files, similar to the existing H5AD support. The block automatically extracts sample identifiers from specified metadata columns and creates grouped datasets for downstream analysis.

  Key features:

  - Import single sample Seurat RDS files (one file per sample)
  - Import multisample Seurat RDS files with multiple samples in one object
  - Automatic sample extraction from metadata columns for multisample files
  - Support for custom sample column names

## 2.2.1

### Patch Changes

- 6c07919: Filter out NaN values from sample list for h5ad files

## 2.2.0

### Minor Changes

- 8cb1841: Multiplexed FASTQ format support

  Added support for multiplexed FASTQ datasets where multiple samples are sequenced together in a single file set. This format is commonly used in barcoded sequencing experiments.

  Key features:

  - Group-based organization with read indices (R1, R2, etc.) per file group
  - Samplesheet import with file ID, sample ID, and barcode ID columns

## 2.1.0

### Minor Changes

- e8c0255: H5AD input file format support

  - Added new dataset types: H5AD and MultiSampleH5AD to handle single-cell data in AnnData H5AD format
  - H5AD dataset type supports per-sample H5AD files (one sample per file)
  - MultiSampleH5AD dataset type supports multi-sample H5AD files with automatic sample extraction
  - New Python-based parser software for H5AD file processing:
    - Automatic sample detection from anndata.obs columns with configurable sample column name (defaults to "sample", "samples", or "replicate")
  - UI enhancements for H5AD dataset import with sample column name selection
  - Workflow templates for parsing and processing H5AD files with sample grouping support

## 2.0.0

### Major Changes

- 3518b67: Implementation of grouped data

### Minor Changes

- ad22412: Added CellRanger MTX format support

  - Added new CellRangerMTX dataset type to handle three-file CellRanger output (matrix.mtx, features.tsv, barcodes.tsv)
  - Removed old unusable MTX format
  - Added {{CellRangerFileRole}} pattern matcher for file name parsing
  - Automatic normalization of genes.tsv to features.tsv for backward compatibility
  - Support for both compressed (.gz) and uncompressed files
  - Workflow creates PColumn with pl7.app/sc/cellRangerFileRole axis and pl7.app/compression domain

## 1.11.2

### Patch Changes

- e8faec7: update dependecies

## 1.11.1

### Patch Changes

- c8d1852: Update sdk (use api v2)

## 1.11.0

### Minor Changes

- e634778: Support CSV/TSV import

## 1.10.1

### Patch Changes

- 3d0d737: Remove tsup build (use vite)

## 1.10.0

### Minor Changes

- 363fcf0: Update dependencies

## 1.9.1

### Patch Changes

- 468906f: Start decomposing "ImportDatasetDialog"
- 06a5344: [design/review] S&D: Add New Dataset Section

## 1.9.0

### Minor Changes

- c0b61eb: Initial implementation for tagged datasets

## 1.8.3

### Patch Changes

- 1ff5da1: SDK upgrade

## 1.8.2

### Patch Changes

- aa1dd4e: SDK upgrade: new registry format

## 1.8.1

### Patch Changes

- cdb6867: Update sdk model, ui-vue, test

## 1.8.0

### Minor Changes

- ebebf39: Trace annotation in the output; SDK upgrade

## 1.7.1

### Patch Changes

- 20db14c: SDK upgrade, minor improvements.

## 1.7.0

### Minor Changes

- 82e916f: Fasta datasets support + minor UX fixes

## 1.6.2

### Patch Changes

- a6d8a0f: Fix for AGGrid and new import button icons

## 1.6.1

### Patch Changes

- ce8663b: SDK upgrade

## 1.6.0

### Minor Changes

- 82307ca: Multilane fastq dataset support

### Patch Changes

- f31934a: SDK upgrade

## 1.5.0

### Minor Changes

- e35d541: - improved table styles
  - moved dataset creating to a button on the Metadata page

## 1.4.2

### Patch Changes

- 1233dab: SDK upgrade

## 1.4.1

### Patch Changes

- a0ebc60: SDK upgrade

## 1.4.0

### Minor Changes

- f5b0ae2: Better file import mechanics.

## 1.3.2

### Patch Changes

- 5d8ff43: Buttons moved to context menu in Metadata window; SDK upgrade

## 1.3.1

### Patch Changes

- 55bcb4d: SDK upgrade & AgGrid license

## 1.3.0

### Minor Changes

- baa9d03: migration to public SDK

## 1.2.0

### Minor Changes

- c77f269: bulk file add and many other improvements

## 1.1.1

### Patch Changes

- aacaa26: SDK Upgrade

## 1.1.0

### Minor Changes

- 01e65cb: Initial release.
