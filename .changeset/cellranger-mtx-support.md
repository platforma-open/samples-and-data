---
'@platforma-open/milaboratories.samples-and-data.model': minor
'@platforma-open/milaboratories.samples-and-data.ui': minor
'@platforma-open/milaboratories.samples-and-data.workflow': minor
---

Added CellRanger MTX format support

- Added new CellRangerMTX dataset type to handle three-file CellRanger output (matrix.mtx, features.tsv, barcodes.tsv)
- Removed old unusable MTX format
- Added {{CellRangerFileRole}} pattern matcher for file name parsing
- Automatic normalization of genes.tsv to features.tsv for backward compatibility
- Support for both compressed (.gz) and uncompressed files
- Workflow creates PColumn with pl7.app/sc/cellRangerFileRole axis and pl7.app/compression domain

