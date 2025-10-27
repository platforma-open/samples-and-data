# @platforma-open/milaboratories.samples-and-data.workflow

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

## 1.13.2

### Patch Changes

- e8faec7: update dependecies

## 1.13.1

### Patch Changes

- c8d1852: Update sdk (use api v2)

## 1.13.0

### Minor Changes

- e634778: Support CSV/TSV import

## 1.12.4

### Patch Changes

- 3d0d737: Remove tsup build (use vite)

## 1.12.3

### Patch Changes

- 1d70af2: Update SDK dependency to get fresh bugfixes

## 1.12.2

### Patch Changes

- c8a903d: chore: update deps

## 1.12.1

### Patch Changes

- 40ec8d7: bump dependencies: compact template compilation

## 1.12.0

### Minor Changes

- d483670: Save dataset samplesIds in axisKeys annotation

## 1.11.0

### Minor Changes

- 363fcf0: Update dependencies

## 1.10.1

### Patch Changes

- 7051768: don't export samples for UI, it greatly saves network and storage

## 1.10.0

### Minor Changes

- c0b61eb: Initial implementation for tagged datasets

## 1.9.2

### Patch Changes

- 1ff5da1: SDK upgrade

## 1.9.1

### Patch Changes

- aa1dd4e: SDK upgrade: new registry format

## 1.9.0

### Minor Changes

- ebebf39: Trace annotation in the output; SDK upgrade

## 1.8.1

### Patch Changes

- 20db14c: SDK upgrade, minor improvements.

## 1.8.0

### Minor Changes

- 82e916f: Fasta datasets support + minor UX fixes

## 1.7.8

### Patch Changes

- a6d8a0f: Fix for AGGrid and new import button icons

## 1.7.7

### Patch Changes

- ce8663b: SDK upgrade

## 1.7.6

### Patch Changes

- a23294d: Minor fix for pl7.app/readIndices annotation in exported columns

## 1.7.5

### Patch Changes

- f31934a: SDK upgrade

## 1.7.4

### Patch Changes

- a0ebc60: SDK upgrade

## 1.7.3

### Patch Changes

- 5d8ff43: Buttons moved to context menu in Metadata window; SDK upgrade

## 1.7.2

### Patch Changes

- 55bcb4d: SDK upgrade & AgGrid license

## 1.7.1

### Patch Changes

- f5a8f97: SDK upgrade

## 1.7.0

### Minor Changes

- baa9d03: migration to public SDK

## 1.6.0

### Minor Changes

- c77f269: bulk file add and many other improvements
- Json export fix

## 1.5.0

### Minor Changes

- dcb139e: migration to newer SDK
- 50e7241: Fix for PColumn key formatting

## 1.4.2

### Patch Changes

- 16806b1: Fix for export spec & SDK upgrades
- aacaa26: SDK Upgrade

## 1.4.1

### Patch Changes

- 98a5578: Added space in UI.

## 1.4.0

### Minor Changes

- 6ca9efb: multilate fastq support
- bc952ca: propper resource data for PColumnData/ResourceMap resources

## 1.3.0

### Minor Changes

- 35b5cf6: sdk upgrade

## 1.2.0

### Minor Changes

- a333776: kind: "PColumn" added to all PColumn export specs

## 1.1.0

### Minor Changes

- 01e65cb: Initial release.
