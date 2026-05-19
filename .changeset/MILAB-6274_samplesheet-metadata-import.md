---
"@platforma-open/milaboratories.samples-and-data.ui": patch
---

Fix samplesheet metadata import on MultiplexedFastq datasets (MILAB-6274). Previously every non-File / non-Sample column was auto-bound as a barcode tag, which pushed all metadata columns into `skippedColumnIndices` and silently dropped them from `args.metadata`. The default is now to auto-bind only columns whose header matches an already-declared barcode tag (case-insensitive substring); other columns flow to metadata as before. The dialog also: allows zero-binding (metadata-only) imports, shows separate Barcode tag / Metadata column counts in the preview, lists unmapped declared tags, and adds an "Add tag binding" picker so operators can still introduce new tags on a fresh dataset.

Also fixes the samplesheet tag-backfill asymmetry: rules appended from a samplesheet row are now only pushed when the row covers every declared tag with a non-empty value, mirroring what the model validator enforces. Rows that do not cover every declared tag still flow through as samples and metadata, but no incomplete rule is created — so the block stays runnable when an operator imports a samplesheet that introduces a new tag without covering pre-existing ones. See `docs/text/work/ad-hoc/sd-samplesheet-tag-backfill-asymmetry.md` for the full analysis.
