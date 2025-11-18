# @platforma-open/milaboratories.samples-and-data.parse-seurat

## 1.1.0

### Minor Changes

- ae6ef20: Seurat RDS format support

  Added support for importing Seurat objects stored in RDS format, including both single sample and multisample datasets. Users can now import Seurat datasets with one or multiple samples, with automatic sample extraction from metadata columns for multisample files, similar to the existing H5AD support. The block automatically extracts sample identifiers from specified metadata columns and creates grouped datasets for downstream analysis.

  Key features:

  - Import single sample Seurat RDS files (one file per sample)
  - Import multisample Seurat RDS files with multiple samples in one object
  - Automatic sample extraction from metadata columns for multisample files
  - Support for custom sample column names
