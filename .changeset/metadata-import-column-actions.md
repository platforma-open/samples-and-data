---
"@platforma-open/milaboratories.samples-and-data.ui": minor
"@platforma-open/milaboratories.samples-and-data": minor
---

Metadata import now decides what to do with every column of the file: add it as a new metadata column, fill an existing column of the project keeping that column's identity, or leave it out. Columns whose name and type match an existing column are pre-set to fill it, so an unchanged import behaves as before. A second mode replaces the project's metadata with the file's columns outright, warning that downstream blocks lose their column selections. Values are no longer written into a column that cannot hold them.
