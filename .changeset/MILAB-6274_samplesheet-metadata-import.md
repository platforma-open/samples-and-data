---
'@platforma-open/milaboratories.samples-and-data.workflow': patch
'@platforma-open/milaboratories.samples-and-data.ui': patch
'@platforma-open/milaboratories.samples-and-data': patch
---

MILAB-6274 — five fixes for MultiplexedFastq dataset setup and downstream integration:

- **Stop auto-binding every column as a barcode tag.** `defaultBindingsFor` now auto-binds only columns whose header matches an already-declared tag (case-insensitive substring); other columns flow to `args.metadata` as before. Previously every non-File / non-Sample column landed in `skippedColumnIndices` and was silently dropped. Allow zero-binding (metadata-only) imports; show separate Barcode tag / Metadata column counts; list unmapped declared tags; add an "Add tag binding" picker for new tags.

- **Skip incomplete rules at import time.** A samplesheet row that fails to cover every declared tag with a non-empty value no longer pushes a partial `BarcodeRule`. Rows still produce a sample and metadata; only the rule append is skipped. Without this guard the dataset's `(rules, tags)` invariant breaks and the block fails to start with an unhelpful "N empty barcode value(s)" error pointing at the rules table rather than the import step.

- **Restore the legacy `pl7.app/sequencing/data/sampleGroups` linker.** Emitted unconditionally for grouped MultiplexedFastq datasets, alongside `pl7.app/sequencing/multiplexingRules`. The rules column only emits when at least one rule exists, so a zero-rules dataset previously had no column bridging `[sampleGroupId]` to `[sampleId]` and downstream demultiplexing blocks (Miltenyi, Demultiplex FASTQ) refused to start. Rules column remains the source of truth for new consumers; linker is a backward-compat shim only and is expected to be deleted in a future major.

- **Pre-bind barcode-like columns and warn on empty bindings.** On a fresh MultiplexedFastq dataset, `legacyBarcodeBindingFor` pre-binds any column whose header contains `barcode` (case-insensitive) to a `BarcodeID` tag — restoring the 1.15.0 ease-of-use for the common single-Barcode-ID flow. A yellow alert fires when the importer is about to produce zero rules, directing the operator to add a binding or proceed for a metadata-only import.

- **Warn on the dataset page when samples exist but rules do not.** A yellow banner on `MultiplexedFastqDatasetPage` surfaces the "author rules before wiring up demultiplexing" hint earlier in the operator flow — catching the file-by-file setup path that bypasses the importer. Hides itself once any rule exists.
