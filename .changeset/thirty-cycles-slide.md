---
"@platforma-open/milaboratories.samples-and-data.workflow": minor
"@platforma-open/milaboratories.samples-and-data.ui": minor
"@platforma-open/milaboratories.samples-and-data": minor
---

Export one `pl7.app/label` column for the groups of every grouped dataset (`sampleGroupLabels`) instead of one column per dataset (`dataset.<id>.sampleGroupLabels`). Every grouped dataset shares the `pl7.app/sampleGroupId` axis, and label lookups such as `findLabels` take the first matching column, so blocks downstream of a project with two or more grouped datasets showed "Unlabelled" or raw group IDs for the groups of all but one dataset. The merged column has no `pl7.app/dataset` domain and sits on the plain group axis.

Fix the import dialog for multisample H5AD and Seurat files:
- "Parsing files…" now waits for the column list of every selected file. Before, it never cleared for files that had been parsed earlier or whose column list was empty.
- A file that cannot be read gets an error naming it, and a file with no metadata columns gets a warning. Create stays disabled in both cases.
- Seurat files added with "+ Add More Files" are now parsed. Before, only the columns of the first files were listed.
- The list of files to parse is cleared when the dialog closes, instead of growing with every import.
