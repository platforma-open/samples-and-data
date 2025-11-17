# @platforma-open/milaboratories.samples-and-data.parse-h5ad

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
