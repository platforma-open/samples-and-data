# @platforma-open/milaboratories.samples-and-data.test

## 2.2.0

### Minor Changes

- 8cb1841: Multiplexed FASTQ format support

  Added support for multiplexed FASTQ datasets where multiple samples are sequenced together in a single file set. This format is commonly used in barcoded sequencing experiments.

  Key features:

  - Group-based organization with read indices (R1, R2, etc.) per file group
  - Samplesheet import with file ID, sample ID, and barcode ID columns

### Patch Changes

- Updated dependencies [8cb1841]
  - @platforma-open/milaboratories.samples-and-data.model@2.2.0

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

### Patch Changes

- Updated dependencies [e8c0255]
  - @platforma-open/milaboratories.samples-and-data.model@2.1.0

## 2.0.0

### Major Changes

- 3518b67: Implementation of grouped data

### Patch Changes

- Updated dependencies [ad22412]
- Updated dependencies [3518b67]
  - @platforma-open/milaboratories.samples-and-data.model@2.0.0

## 1.6.4

### Patch Changes

- e8faec7: update dependecies
- Updated dependencies [e8faec7]
  - @platforma-open/milaboratories.samples-and-data.model@1.11.2

## 1.6.3

### Patch Changes

- c8d1852: Update sdk (use api v2)
- Updated dependencies [c8d1852]
  - @platforma-open/milaboratories.samples-and-data.model@1.11.1

## 1.6.2

### Patch Changes

- Updated dependencies [e634778]
  - @platforma-open/milaboratories.samples-and-data.model@1.11.0

## 1.6.1

### Patch Changes

- 3d0d737: Remove tsup build (use vite)
- Updated dependencies [3d0d737]
  - @platforma-open/milaboratories.samples-and-data.model@1.10.1

## 1.6.0

### Minor Changes

- 363fcf0: Update dependencies

### Patch Changes

- Updated dependencies [363fcf0]
  - @platforma-open/milaboratories.samples-and-data.model@1.10.0

## 1.5.5

### Patch Changes

- Updated dependencies [468906f]
- Updated dependencies [06a5344]
  - @platforma-open/milaboratories.samples-and-data.model@1.9.1

## 1.5.4

### Patch Changes

- Updated dependencies [c0b61eb]
  - @platforma-open/milaboratories.samples-and-data.model@1.9.0

## 1.5.3

### Patch Changes

- 1ff5da1: SDK upgrade
- Updated dependencies [1ff5da1]
  - @platforma-open/milaboratories.samples-and-data.model@1.8.3

## 1.5.2

### Patch Changes

- aa1dd4e: SDK upgrade: new registry format
- Updated dependencies [aa1dd4e]
  - @platforma-open/milaboratories.samples-and-data.model@1.8.2

## 1.5.1

### Patch Changes

- cdb6867: Update sdk model, ui-vue, test
- Updated dependencies [cdb6867]
  - @platforma-open/milaboratories.samples-and-data.model@1.8.1

## 1.5.0

### Minor Changes

- ebebf39: Trace annotation in the output; SDK upgrade

### Patch Changes

- Updated dependencies [ebebf39]
  - @platforma-open/milaboratories.samples-and-data.model@1.8.0

## 1.4.8

### Patch Changes

- Updated dependencies [20db14c]
  - @platforma-open/milaboratories.samples-and-data.model@1.7.1

## 1.4.7

### Patch Changes

- a6d8a0f: Fix for AGGrid and new import button icons

## 1.4.6

### Patch Changes

- ce8663b: SDK upgrade

## 1.4.5

### Patch Changes

- f31934a: SDK upgrade

## 1.4.4

### Patch Changes

- 1233dab: SDK upgrade

## 1.4.3

### Patch Changes

- a0ebc60: SDK upgrade

## 1.4.2

### Patch Changes

- 5d8ff43: Buttons moved to context menu in Metadata window; SDK upgrade

## 1.4.1

### Patch Changes

- 55bcb4d: SDK upgrade & AgGrid license

## 1.4.0

### Minor Changes

- baa9d03: migration to public SDK

## 1.3.0

### Minor Changes

- c77f269: bulk file add and many other improvements

## 1.2.0

### Minor Changes

- dcb139e: migration to newer SDK

### Patch Changes

- 50e7241: SDK upgrade

## 1.1.1

### Patch Changes

- aacaa26: SDK Upgrade

## 1.1.0

### Minor Changes

- 01e65cb: Initial release.
