---
'@platforma-open/milaboratories.samples-and-data.workflow': patch
'@platforma-open/milaboratories.samples-and-data': patch
---

Restore the `pl7.app/sequencing/data/sampleGroups` linker column for grouped MultiplexedFastq datasets. Emitted unconditionally alongside the newer `pl7.app/sequencing/multiplexingRules` column to keep downstream consumers (e.g. Miltenyi clonotyping) operable on datasets that have group↔sample membership but no authored barcode rules — the case PR #119's "single-emission" stance did not cover. The rules column only emits when at least one rule exists, so a zero-rules dataset previously had no column bridging `[sampleGroupId]` to `[sampleId]` and downstream demultiplexing blocks refused to start. Rules column remains the source of truth for new consumers; linker is a backward-compat shim only and is expected to be deleted in a future major.
