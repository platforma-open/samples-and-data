---
"@platforma-open/milaboratories.samples-and-data.workflow": minor
"@platforma-open/milaboratories.samples-and-data.ui": minor
"@platforma-open/milaboratories.samples-and-data": minor
---

Export one `pl7.app/label` column for the groups of every grouped dataset (`sampleGroupLabels`) instead of one column per dataset (`dataset.<id>.sampleGroupLabels`). Every grouped dataset shares the `pl7.app/sampleGroupId` axis, and label lookups such as `findLabels` take the first matching column, so blocks downstream of a project with two or more grouped datasets showed "Unlabelled" or raw group IDs for the groups of all but one dataset. The merged column has no `pl7.app/dataset` domain and sits on the plain group axis.
