---
"@platforma-open/milaboratories.samples-and-data.workflow": minor
"@platforma-open/milaboratories.samples-and-data": minor
"@platforma-open/milaboratories.samples-and-data.model": minor
"@platforma-open/milaboratories.samples-and-data.kind": minor
"@platforma-open/milaboratories.samples-and-data.test": minor
"@platforma-open/milaboratories.samples-and-data.ui": minor
---

New dataset type "Multisample CSV/TSV": long CSV/TSV tables (one file per group, `.gz` supported) where one column names the samples.

- In the import dialog, pick the sample column; "Import samples" creates one sample per distinct value of that column (read as text; empty and whitespace-only values are skipped; at most 3000 per file). A value found in several files gives one sample per file, labelled "<value> (<file label>)".
- The dataset exports `pl7.app/sequencing/data/sampleGroups` on `[sampleGroupId, sampleId]` (the sample's value in the file), so an import block can put each sample's rows on the Samples & Data sample axis and its metadata.
- The import dialog offers only columns every file has, and refuses mixed CSV/TSV files or files whose separator or compression differs from the target dataset's.
- "Import samples" now counts distinct sample names and shows extraction errors instead of waiting forever (all grouped dataset types).
- The multiplexing rules column is written in canonical order.
- SDK updated.
