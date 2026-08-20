---
'@platforma-open/milaboratories.samples-and-data.parse-h5ad': patch
'@platforma-open/milaboratories.samples-and-data.parse-seurat': patch
'@platforma-open/milaboratories.samples-and-data.model': minor
'@platforma-open/milaboratories.samples-and-data': minor
---

Migrate to structure v2 and declare a block kind

The SDK upgrade moves the block onto the current canonical layout (block-tools
2.14.0, model/ui-vue 1.82.x, workflow-tengo 6.8.2, tengo-builder 4.0.23) and
switches the software packages from `pl-pkg` to `block-tools software build`.

The block now declares a kind, whose init-params contract is the study setup a
project template supplies — the metadata columns the study collects, the name of
the sample column, and how its datasets are configured — plus whichever of its
data can be resolved from where the block lands.

A dataset travels whole when every one of its files is a storage reference
(`index://` names a storage and a path); a dataset holding any local upload is
reduced to its configuration with the file slots unset, because an upload handle
carries a machine-local path signed with the installation's own secret. The
decision is per dataset rather than per file so that a grouped dataset can never
arrive with fewer sample groups than file groups, which is the invariant `args`
enforces. Samples, their labels and their metadata values follow the datasets
that reference them, so a sample never arrives without the files that created
it.

The dataset and metadata types move into the kind package and are re-exported
from the model, so every existing import keeps resolving. The model also exports
`templateParamsFor`, the projection itself.
