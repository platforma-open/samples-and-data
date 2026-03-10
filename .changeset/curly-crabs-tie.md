---
'@platforma-open/milaboratories.samples-and-data.workflow': patch
---

Fix cross-dataset sample leakage in downstream blocks

The sample label column was created once with a block-wide sampleId axis, causing all samples from all datasets to appear in downstream blocks (e.g. CDR3 Spectratype "show for" dropdown) even when only one dataset was selected for analysis.

Each dataset now uses a per-dataset sampleId axis (domain includes `pl7.app/dataset`) and its own label column containing only that dataset's samples. Downstream blocks inherit the dataset-scoped axis from the input spec and only match the correct label column.
