# @platforma-open/milaboratories.samples-and-data.kind

## 1.2.0

### Minor Changes

- a8fa850: New dataset type "Multisample CSV/TSV": long CSV/TSV tables (one file per group, `.gz` supported) where one column names the samples.

  - In the import dialog, pick the sample column; "Import samples" creates one sample per distinct value of that column (read as text; empty and whitespace-only values are skipped; at most 3000 per file). A value found in several files gives one sample per file, labelled "<value> (<file label>)".
  - The dataset exports `pl7.app/sequencing/data/sampleGroups` on `[sampleGroupId, sampleId]` (the sample's value in the file), so an import block can put each sample's rows on the Samples & Data sample axis and its metadata.
  - The import dialog offers only columns every file has, and refuses mixed CSV/TSV files or files whose separator or compression differs from the target dataset's.
  - "Import samples" now counts distinct sample names and shows extraction errors instead of waiting forever (all grouped dataset types).
  - The multiplexing rules column is written in canonical order.
  - SDK updated.

## 1.1.0

### Minor Changes

- b9e7578: Add the `TaggedAb1` dataset type for Sanger chromatograms. One `.ab1` file per sample per tag, exported as a `File` column with `pl7.app/fileExtension` `ab1` on axes `[pl7.app/sampleId, pl7.app/sequencing/tag]`. A pattern such as `{{Sample}}_{{:Primer}}.ab1` groups the traces of one sample by the tag that tells them apart, for example the sequencing primer.
