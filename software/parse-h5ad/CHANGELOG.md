# @platforma-open/milaboratories.samples-and-data.parse-h5ad

## 1.1.6

### Patch Changes

- 8321901: Migrate to structure v2 and declare a block kind

  The SDK upgrade moves the block onto the current canonical layout (block-tools
  2.14.0, model/ui-vue 1.82.x, workflow-tengo 6.8.2, tengo-builder 4.0.23) and
  switches the software packages from `pl-pkg` to `block-tools software build`.

  The block now declares a kind, whose init-params contract is the study setup a
  project template supplies — the metadata columns the study collects, the name of
  the sample column, and how its datasets are configured — plus whichever of its
  data can be resolved from where the block lands.

  A dataset travels whole when every one of its files is a storage reference
  (`index://` names a storage and a path); a dataset holding any local upload is
  reduced to its configuration with the file slots unset, because an upload handle
  carries a machine-local path signed with the installation's own secret. The
  decision is per dataset rather than per file so that a grouped dataset can never
  arrive with fewer sample groups than file groups, which is the invariant `args`
  enforces. Samples, their labels and their metadata values follow the datasets
  that reference them, so a sample never arrives without the files that created
  it.

  The dataset and metadata types move into the kind package and are re-exported
  from the model, so every existing import keeps resolving. The model also exports
  `templateParamsFor`, the projection itself.

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
