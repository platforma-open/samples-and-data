# @platforma-open/milaboratories.samples-and-data.ui

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

## 2.2.2

### Patch Changes

- 5a2804c: Add helper to collect read indices from manual patterns and automatically sync `readIndices` when the compiled pattern changes in the import dialog.

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

## 1.18.2

### Patch Changes

- e8faec7: update dependecies

## 1.18.1

### Patch Changes

- c8d1852: Update sdk (use api v2)

## 1.18.0

### Minor Changes

- e634778: Support CSV/TSV import

## 1.17.4

### Patch Changes

- 3d0d737: Remove tsup build (use vite)

## 1.17.3

### Patch Changes

- 540544f: Fix breadcrumbs in plFileDialog

## 1.17.2

### Patch Changes

- 61a4bfe: [MILAB-1966] Update ui-sdk (better performance)

## 1.17.1

### Patch Changes

- 5463fc6: Attempt to fix table blinking on big data (result is unknown)

## 1.17.0

### Minor Changes

- 363fcf0: Update dependencies

## 1.16.4

### Patch Changes

- e39205a: [samples-and-data] Automatically resize metadata columns to fit width

## 1.16.3

### Patch Changes

- 468906f: Start decomposing "ImportDatasetDialog"
- 06a5344: [design/review] S&D: Add New Dataset Section

## 1.16.2

### Patch Changes

- 31a78a6: Added column type marker in header

## 1.16.1

### Patch Changes

- d5a1df7: package version update

## 1.16.0

### Minor Changes

- c0b61eb: Initial implementation for tagged datasets

## 1.15.0

### Minor Changes

- 1ff5da1: Multiple small fixes and improvements

### Patch Changes

- 1ff5da1: SDK upgrade

## 1.14.0

### Minor Changes

- d775001: Update AgGrid and add row number column

## 1.13.5

### Patch Changes

- 0f501b9: Update ui-vue (FileDialog selection supports Ctrl on Windows/Linux)

## 1.13.4

### Patch Changes

- aa1dd4e: SDK upgrade: new registry format

## 1.13.3

### Patch Changes

- cdb6867: Update sdk model, ui-vue, test
- 21ee8ce: \*.fq file support fix

## 1.13.2

### Patch Changes

- d142efb: \*.fq extension support for FASTA files
- c2545a2: Block-wide upload progress
- 8a0fc95: Editable title

## 1.13.1

### Patch Changes

- ef21209: Prevent import dialog close if clicked outside.

## 1.13.0

### Minor Changes

- ebebf39: Trace annotation in the output; SDK upgrade

## 1.12.1

### Patch Changes

- 20db14c: SDK upgrade, minor improvements.
- 499f85f: updated icon and package
- da1d69e: ui-vue 1.10.18

## 1.12.0

### Minor Changes

- 82e916f: Fasta datasets support + minor UX fixes

## 1.11.4

### Patch Changes

- a6d8a0f: Fix for AGGrid and new import button icons

## 1.11.3

### Patch Changes

- ce8663b: Fixes import dataset dialog reopen after cancel

## 1.11.2

### Patch Changes

- d9b8f93: Multilate Dataset UI migration to new AgGrid theming API

## 1.11.1

### Patch Changes

- f19fca3: Use the new AgGrid theming API

## 1.11.0

### Minor Changes

- 82307ca: Multilane fastq dataset support

### Patch Changes

- f31934a: SDK upgrade

## 1.10.0

### Minor Changes

- e35d541: - improved table styles
  - moved dataset creating to a button on the Metadata page

## 1.9.1

### Patch Changes

- 7e7128f: update ui: remove last error handling from FileCells

## 1.9.0

### Minor Changes

- 1233dab: All dependencies moved to devDependencies

## 1.8.1

### Patch Changes

- 611c3bf: SDK Upgrade: fixes AGGrid watermark

## 1.8.0

### Minor Changes

- a0ebc60: Metadata import from table

### Patch Changes

- a0ebc60: SDK upgrade
- Updated dependencies [a0ebc60]
  - @platforma-open/milaboratories.samples-and-data.model@1.4.1

## 1.7.0

### Minor Changes

- f5b0ae2: Better file import mechanics.

### Patch Changes

- Updated dependencies [f5b0ae2]
  - @platforma-open/milaboratories.samples-and-data.model@1.4.0

## 1.6.2

### Patch Changes

- 5d8ff43: Buttons moved to context menu in Metadata window; SDK upgrade
- Updated dependencies [5d8ff43]
  - @platforma-open/milaboratories.samples-and-data.model@1.3.2

## 1.6.1

### Patch Changes

- 55bcb4d: SDK upgrade & AgGrid license
- Updated dependencies [55bcb4d]
  - @platforma-open/milaboratories.samples-and-data.model@1.3.1

## 1.6.0

### Minor Changes

- baa9d03: migration to public SDK

### Patch Changes

- b944bf4: integrate new file input component (with progress), fix multiple selection in file dialog
- Updated dependencies [baa9d03]
  - @platforma-open/milaboratories.samples-and-data.model@1.3.0

## 1.5.0

### Minor Changes

- c77f269: bulk file add and many other improvements

### Patch Changes

- Updated dependencies [c77f269]
  - @platforma-open/milaboratories.samples-and-data.model@1.2.0

## 1.4.1

### Patch Changes

- fe31ab8: fixes lens, so that onDisconnect() is called when target part of model desappears

## 1.4.0

### Minor Changes

- dcb139e: migration to newer SDK

### Patch Changes

- 50e7241: SDK upgrade

## 1.3.2

### Patch Changes

- aacaa26: SDK Upgrade
- Updated dependencies [aacaa26]
  - @platforma-open/milaboratories.samples-and-data.model@1.1.1

## 1.3.1

### Patch Changes

- 98a5578: Added space in UI.

## 1.3.0

### Minor Changes

- 01e65cb: Initial release.

### Patch Changes

- Updated dependencies [01e65cb]
  - @platforma-open/milaboratories.samples-and-data.model@1.1.0
