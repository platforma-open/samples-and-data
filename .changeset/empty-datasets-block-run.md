---
"@platforma-open/milaboratories.samples-and-data.model": minor
"@platforma-open/milaboratories.samples-and-data": minor
---

A dataset with no data now blocks Run: the block reports which datasets are empty instead of silently exporting empty columns. A block with no datasets still runs. This is the state a project template seeds, so a project created from a template cannot be run until files are added.
