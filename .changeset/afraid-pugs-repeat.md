---
"@platforma-open/milaboratories.samples-and-data.model": minor
"@platforma-open/milaboratories.samples-and-data": minor
---

Export the study setup without its data: template params now always strip datasets and metadata columns down to their configuration, dropping everything keyed by sample or by group (files, sample ids and labels), instead of carrying a fully populated state when every file happened to be a storage reference.
