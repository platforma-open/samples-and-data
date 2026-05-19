---
"@platforma-open/milaboratories.samples-and-data.ui": patch
---

Add a warning banner on `MultiplexedFastqDatasetPage` for datasets that have samples assigned but no barcode rules. Surfaces the "author rules before wiring up demultiplexing" hint earlier in the operator flow — before they reach the downstream block. Hides itself once any rule exists.
