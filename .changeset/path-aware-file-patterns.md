---
"@platforma-open/milaboratories.samples-and-data.ui": minor
---

Read sample identity from the folder, not just the file name.

Patterns were matched against the bare file name, so a one-folder-per-sample tree — what BaseSpace, bcl2fastq and CellRanger all produce — could not be described. Where the folder was the only place a sample name appeared, every file resolved to the same sample and all but the last were dropped without a word.

- Patterns are now matched against each file's path relative to the longest common directory of the selection. With every file in one folder that is the bare file name, so flat imports are unchanged.
- `{{Sample}}`, `{{*}}` and tag matchers are bounded to one path segment; the new `{{**}}` crosses segments. `{{**}}/{{Sample}}_S{{n}}_L{{n}}_{{RR}}_{{n}}.fastq.gz` and `{{Sample}}/{{R}}.fastq.gz` both work.
- Inference tries the file name, folder-ignored and folder-carries-identity forms, and takes the first that gives every file its own identity. Per-sample-folder FASTQ and per-sample-folder CellRanger MTX (`Sample_A/matrix.mtx.gz`) now infer.
- The canonical Illumina naming `<Sample>_S<n>_L<lane>_<read>_001` is recognised, so `A_S7_L001_R1_001.fastq.gz` gives sample `A` rather than `A_S7`. This changes inferred sample names for bcl2fastq/BaseSpace output — `_S<n>` is the sample number, not part of the name.
- A pattern that maps two files onto one identity is reported in the import dialog and blocks the import, instead of silently overwriting.
