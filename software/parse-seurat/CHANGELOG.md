# @platforma-open/milaboratories.samples-and-data.parse-seurat

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
