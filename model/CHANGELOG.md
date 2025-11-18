# @platforma-open/milaboratories.samples-and-data.model

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
