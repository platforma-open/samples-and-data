---
"@platforma-open/milaboratories.samples-and-data.ui": patch
---

Fix samplesheet metadata import on MultiplexedFastq datasets (MILAB-6274). Previously every non-File / non-Sample column was auto-bound as a barcode tag, which pushed all metadata columns into `skippedColumnIndices` and silently dropped them from `args.metadata`. The default is now to auto-bind only columns whose header matches an already-declared barcode tag (case-insensitive substring); other columns flow to metadata as before. The dialog also: allows zero-binding (metadata-only) imports, shows separate Barcode tag / Metadata column counts in the preview, lists unmapped declared tags, and adds an "Add tag binding" picker so operators can still introduce new tags on a fresh dataset.
