# @platforma-open/milaboratories.samples-and-data.parse-h5ad

## 1.1.5

### Patch Changes

- 9d96dff: Upgrade SDK

## 1.1.4

### Patch Changes

- 919bf93: Migrate the block onto the structurer (`block-tools structure`): adopt the canonical project skeleton (tsconfig, oxlint/oxfmt, turbo, block index, workflow format/vitest), SDK catalog bump (model/ui-vue 1.65→1.79, workflow-tengo 5→6, tengo-builder 3→4, +ts-builder/ts-configs), legacy tooling cleanup (vite/eslint/tsup/vitest), and pin `vue` to `3.5.24`. No user-facing behavior change.

## 1.1.3

### Patch Changes

- 47cb5bb: Update anndata version to support newer files

## 1.1.2

### Patch Changes

- dc479f3: technical release

## 1.1.1

### Patch Changes

- 6c07919: Filter out NaN values from sample list for h5ad files

## 1.1.0

### Minor Changes

- e8c0255: H5AD input file format support

  - Added new dataset types: H5AD and MultiSampleH5AD to handle single-cell data in AnnData H5AD format
  - H5AD dataset type supports per-sample H5AD files (one sample per file)
  - MultiSampleH5AD dataset type supports multi-sample H5AD files with automatic sample extraction
  - New Python-based parser software for H5AD file processing:
    - Automatic sample detection from anndata.obs columns with configurable sample column name (defaults to "sample", "samples", or "replicate")
  - UI enhancements for H5AD dataset import with sample column name selection
  - Workflow templates for parsing and processing H5AD files with sample grouping support
