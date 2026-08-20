# @platforma-open/milaboratories.samples-and-data.parse-seurat

## 1.1.5

### Patch Changes

- 8321901: Migrate to structure v2 and declare a block kind

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

## 1.1.4

### Patch Changes

- 9d96dff: Upgrade SDK

## 1.1.3

### Patch Changes

- 919bf93: Migrate the block onto the structurer (`block-tools structure`): adopt the canonical project skeleton (tsconfig, oxlint/oxfmt, turbo, block index, workflow format/vitest), SDK catalog bump (model/ui-vue 1.65→1.79, workflow-tengo 5→6, tengo-builder 3→4, +ts-builder/ts-configs), legacy tooling cleanup (vite/eslint/tsup/vitest), and pin `vue` to `3.5.24`. No user-facing behavior change.

## 1.1.2

### Patch Changes

- 36f4458: Fix runtime `Permission denied` when the parse-seurat container runs as a non-root UID (MILAB-6263). The entrypoint re-invoked `renv::restore()` on every start, which tries to reconcile the system R library at `/usr/local/lib/R/site-library/` with the project lockfile. When the `r-base:4.4.2` base image preinstalled a version of a locked package (e.g. `rlang`) that differs from `renv.lock`, renv attempted to back up the system-library copy before replacing it — failing on hosts that run the container unprivileged. renv now installs into a project-local library at `/app/renv/library` and `R_LIBS_USER` points R at the same path, so the obsolete `/app/run.sh` wrapper and runtime restore are removed.

## 1.1.1

### Patch Changes

- dc479f3: technical release

## 1.1.0

### Minor Changes

- ae6ef20: Seurat RDS format support

  Added support for importing Seurat objects stored in RDS format, including both single sample and multisample datasets. Users can now import Seurat datasets with one or multiple samples, with automatic sample extraction from metadata columns for multisample files, similar to the existing H5AD support. The block automatically extracts sample identifiers from specified metadata columns and creates grouped datasets for downstream analysis.

  Key features:

  - Import single sample Seurat RDS files (one file per sample)
  - Import multisample Seurat RDS files with multiple samples in one object
  - Automatic sample extraction from metadata columns for multisample files
  - Support for custom sample column names
