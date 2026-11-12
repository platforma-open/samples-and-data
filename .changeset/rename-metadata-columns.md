---
"@platforma-open/milaboratories.samples-and-data.ui": minor
"@platforma-open/milaboratories.samples-and-data": minor
---

Rename a metadata column from its header menu. The new name must be non-empty and must not match another metadata column's name, ignoring case and surrounding spaces. The same check now applies when adding a column, whose suggested name skips names already taken. Before, two columns could share a name and were then exported as one column, losing each other's values. A metadata column is exported under its name, so renaming it changes the column's spec and marks downstream blocks for a re-run. Downstream blocks still find the renamed column, because they reference it by its export name, `metadata.<id>`, which does not change.
