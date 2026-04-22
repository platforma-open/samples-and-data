---
'@platforma-open/milaboratories.samples-and-data.ui': minor
'@platforma-open/milaboratories.samples-and-data': minor
---

Samplesheet import in `SyncDatasetDialog` now accepts TSV, CSV, and TXT files in addition to XLSX. The metadata import parser dispatches on file extension, so `.tsv` files are parsed with a tab separator instead of being auto-detected.
