---
'@platforma-open/milaboratories.samples-and-data.model': minor
'@platforma-open/milaboratories.samples-and-data.workflow': minor
'@platforma-open/milaboratories.samples-and-data.ui': minor
'@platforma-open/milaboratories.samples-and-data': minor
---

Add remote metadata file import support via PlFileDialog

Users can now select metadata files from remote storage (S3, cloud storage, etc.) in addition to local files. When a remote file is selected, the backend downloads it via the prerun and makes it available to the UI for parsing. A loading modal shows during download; once ready, the existing ImportMetadataDialog appears for sample matching and import.
