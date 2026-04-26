---
"@platforma-open/milaboratories.samples-and-data": minor
"@platforma-open/milaboratories.samples-and-data.workflow": minor
"@platforma-open/milaboratories.samples-and-data.ui": minor
---

Multiplexed FASTQ: fix sample-group labels and merge same-named samples across file groups.

- **Sample-group label column now resolves.** The per-dataset `pl7.app/label` column on the `pl7.app/sampleGroupId` axis was being emitted with an empty data map (workflow was reading `dataset.groupLabels` instead of `dataset.content.groupLabels`), which made the SDK render every group id as "Unlabelled" in downstream blocks. Points the column at the right field; downstream consumers (e.g. the Demultiplex FASTQ block) now show real file-group labels.
- **Samplesheet import deduplicates by sample label.** Importing a samplesheet now reuses an existing sampleId when a sample with that label already exists in the block; only new labels mint a fresh PlId. As a result, the same sample appearing in multiple file groups (shared across pools) is represented by a single block-level sampleId that links to both groups, instead of two parallel sampleIds with identical labels.
- **Linker axis-keys annotation deduped.** The `pl7.app/axisKeys/1` hint on the sample-groups linker column now lists each sampleId once even when it participates in several groups.
