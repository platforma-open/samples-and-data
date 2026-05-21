---
"@platforma-open/milaboratories.samples-and-data.ui": patch
---

Fix samplesheet metadata import on `MultiplexedFastq` datasets (MILAB-6274). The import dialog no longer auto-binds every non-File / non-Sample column as a barcode tag — that bug silently dropped metadata columns like `Condition` and `Treatment`. Auto-bind now restricts to columns whose header matches an already-declared tag (case-insensitive substring); unmatched columns flow through the metadata pipeline.

On a fresh `MultiplexedFastq` dataset with no declared tags, the dialog auto-binds any column whose header contains `barcode` (case-insensitive) as a `BarcodeID` tag. This restores end-to-end compatibility with Miltenyi clonotyping and other demultiplex blocks: operators get one rule per sample without manually authoring tags, the dataset's `multiplexingRules` column emits, and the downstream block runs cleanly.

Zero-binding imports (metadata-only samplesheets on fresh datasets) are now allowed.
