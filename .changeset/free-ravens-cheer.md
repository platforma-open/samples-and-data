---
'@platforma-open/milaboratories.samples-and-data.workflow': minor
'@platforma-open/milaboratories.samples-and-data.model': minor
'@platforma-open/milaboratories.samples-and-data.test': minor
'@platforma-open/milaboratories.samples-and-data.ui': minor
---

Multiplexed FASTQ format support

Added support for multiplexed FASTQ datasets where multiple samples are sequenced together in a single file set. This format is commonly used in barcoded sequencing experiments.

Key features:
- Group-based organization with read indices (R1, R2, etc.) per file group
- Samplesheet import with file ID, sample ID, and barcode ID columns
