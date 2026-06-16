---
"@platforma-open/milaboratories.samples-and-data.model": patch
"@platforma-open/milaboratories.samples-and-data.ui": patch
"@platforma-open/milaboratories.samples-and-data.workflow": patch
---

Migrate the block onto the structurer (`block-tools structure`): adopt the canonical project skeleton (tsconfig, oxlint/oxfmt, turbo, block index, workflow format/vitest), SDK catalog bump (model/ui-vue 1.65→1.79, workflow-tengo 5→6, tengo-builder 3→4, +ts-builder/ts-configs), legacy tooling cleanup (vite/eslint/tsup/vitest), and pin `vue` to `3.5.24`. No user-facing behavior change.
