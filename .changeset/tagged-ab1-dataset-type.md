---
"@platforma-open/milaboratories.samples-and-data": minor
"@platforma-open/milaboratories.samples-and-data.kind": minor
"@platforma-open/milaboratories.samples-and-data.workflow": patch
"@platforma-open/milaboratories.samples-and-data.ui": patch
---

Add the `TaggedAb1` dataset type for Sanger chromatograms. One `.ab1` file per sample per tag, exported as a `File` column with `pl7.app/fileExtension` `ab1` on axes `[pl7.app/sampleId, pl7.app/sequencing/tag]`. A pattern such as `{{Sample}}_{{:Primer}}.ab1` groups the traces of one sample by the tag that tells them apart, for example the sequencing primer.
