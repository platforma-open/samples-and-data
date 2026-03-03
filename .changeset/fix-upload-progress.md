---
'@platforma-open/milaboratories.samples-and-data.model': patch
'@platforma-open/milaboratories.samples-and-data': patch
---

Fix upload progress reporting and block running state:
- Split fileImports into main (with progress) and prerun (upload-only) active outputs
- Add uploadedFiles workflow output to block on upload completion, keeping calculationStatus "Running" until done
