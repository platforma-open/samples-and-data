# @platforma-open/milaboratories.samples-and-data

## 1.13.2

### Patch Changes

- c130999: Revert v3 model migraion
- Updated dependencies [c130999]
  - @platforma-open/milaboratories.samples-and-data.model@2.5.2
  - @platforma-open/milaboratories.samples-and-data.ui@2.5.2

## 1.13.1

### Patch Changes

- Updated dependencies [1a100d0]
  - @platforma-open/milaboratories.samples-and-data.model@2.5.1
  - @platforma-open/milaboratories.samples-and-data.ui@2.5.1

## 1.13.0

### Minor Changes

- ed17db5: Added subtitle, removed editable title

### Patch Changes

- Updated dependencies [ed17db5]
  - @platforma-open/milaboratories.samples-and-data.workflow@2.5.0
  - @platforma-open/milaboratories.samples-and-data.model@2.5.0
  - @platforma-open/milaboratories.samples-and-data.ui@2.5.0

## 1.12.4

### Patch Changes

- @platforma-open/milaboratories.samples-and-data.workflow@2.4.2

## 1.12.3

### Patch Changes

- dc479f3: technical release
- Updated dependencies [dc479f3]
  - @platforma-open/milaboratories.samples-and-data.model@2.4.1
  - @platforma-open/milaboratories.samples-and-data.ui@2.4.3
  - @platforma-open/milaboratories.samples-and-data.workflow@2.4.1

## 1.12.2

### Patch Changes

- Updated dependencies [7c0b1c2]
  - @platforma-open/milaboratories.samples-and-data.ui@2.4.2

## 1.12.1

### Patch Changes

- Updated dependencies [9facd6f]
  - @platforma-open/milaboratories.samples-and-data.ui@2.4.1

## 1.12.0

### Minor Changes

- 4a2bbae: h5 file format support implemented

### Patch Changes

- Updated dependencies [4a2bbae]
  - @platforma-open/milaboratories.samples-and-data.workflow@2.4.0
  - @platforma-open/milaboratories.samples-and-data.model@2.4.0
  - @platforma-open/milaboratories.samples-and-data.ui@2.4.0

## 1.11.1

### Patch Changes

- Updated dependencies [94af1ab]
  - @platforma-open/milaboratories.samples-and-data.workflow@2.3.1

## 1.11.0

### Minor Changes

- ae6ef20: Seurat RDS format support

  Added support for importing Seurat objects stored in RDS format, including both single sample and multisample datasets. Users can now import Seurat datasets with one or multiple samples, with automatic sample extraction from metadata columns for multisample files, similar to the existing H5AD support. The block automatically extracts sample identifiers from specified metadata columns and creates grouped datasets for downstream analysis.

  Key features:

  - Import single sample Seurat RDS files (one file per sample)
  - Import multisample Seurat RDS files with multiple samples in one object
  - Automatic sample extraction from metadata columns for multisample files
  - Support for custom sample column names

### Patch Changes

- Updated dependencies [ae6ef20]
  - @platforma-open/milaboratories.samples-and-data.workflow@2.3.0
  - @platforma-open/milaboratories.samples-and-data.model@2.3.0
  - @platforma-open/milaboratories.samples-and-data.ui@2.3.0

## 1.10.19

### Patch Changes

- Updated dependencies [5a2804c]
  - @platforma-open/milaboratories.samples-and-data.ui@2.2.2

## 1.10.18

### Patch Changes

- 6c07919: Filter out NaN values from sample list for h5ad files
- Updated dependencies [6c07919]
  - @platforma-open/milaboratories.samples-and-data.model@2.2.1
  - @platforma-open/milaboratories.samples-and-data.ui@2.2.1
  - @platforma-open/milaboratories.samples-and-data.workflow@2.2.1

## 1.10.17

### Patch Changes

- Updated dependencies [8cb1841]
  - @platforma-open/milaboratories.samples-and-data.workflow@2.2.0
  - @platforma-open/milaboratories.samples-and-data.model@2.2.0
  - @platforma-open/milaboratories.samples-and-data.ui@2.2.0

## 1.10.16

### Patch Changes

- Updated dependencies [e8c0255]
  - @platforma-open/milaboratories.samples-and-data.workflow@2.1.0
  - @platforma-open/milaboratories.samples-and-data.model@2.1.0
  - @platforma-open/milaboratories.samples-and-data.ui@2.1.0

## 1.10.15

### Patch Changes

- Updated dependencies [ad22412]
- Updated dependencies [3518b67]
  - @platforma-open/milaboratories.samples-and-data.model@2.0.0
  - @platforma-open/milaboratories.samples-and-data.ui@2.0.0
  - @platforma-open/milaboratories.samples-and-data.workflow@2.0.0

## 1.10.14

### Patch Changes

- 6d75f36: Full SDK update

## 1.10.13

### Patch Changes

- e8faec7: update dependecies
- Updated dependencies [e8faec7]
  - @platforma-open/milaboratories.samples-and-data.model@1.11.2
  - @platforma-open/milaboratories.samples-and-data.ui@1.18.2
  - @platforma-open/milaboratories.samples-and-data.workflow@1.13.2

## 1.10.12

### Patch Changes

- f6437d5: update test dependencies

## 1.10.11

### Patch Changes

- 5e88be4: update dependencies

## 1.10.10

### Patch Changes

- c8d1852: Update sdk (use api v2)
- Updated dependencies [c8d1852]
  - @platforma-open/milaboratories.samples-and-data.model@1.11.1
  - @platforma-open/milaboratories.samples-and-data.ui@1.18.1
  - @platforma-open/milaboratories.samples-and-data.workflow@1.13.1

## 1.10.9

### Patch Changes

- Updated dependencies [e634778]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.13.0
  - @platforma-open/milaboratories.samples-and-data.model@1.11.0
  - @platforma-open/milaboratories.samples-and-data.ui@1.18.0

## 1.10.8

### Patch Changes

- 3d0d737: Remove tsup build (use vite)
- Updated dependencies [3d0d737]
  - @platforma-open/milaboratories.samples-and-data.model@1.10.1
  - @platforma-open/milaboratories.samples-and-data.ui@1.17.4
  - @platforma-open/milaboratories.samples-and-data.workflow@1.12.4

## 1.10.7

### Patch Changes

- Updated dependencies [1d70af2]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.12.3

## 1.10.6

### Patch Changes

- Updated dependencies [c8a903d]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.12.2

## 1.10.5

### Patch Changes

- Updated dependencies [40ec8d7]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.12.1

## 1.10.4

### Patch Changes

- Updated dependencies [d483670]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.12.0

## 1.10.3

### Patch Changes

- Updated dependencies [540544f]
  - @platforma-open/milaboratories.samples-and-data.ui@1.17.3

## 1.10.2

### Patch Changes

- Updated dependencies [61a4bfe]
  - @platforma-open/milaboratories.samples-and-data.ui@1.17.2

## 1.10.1

### Patch Changes

- Updated dependencies [5463fc6]
  - @platforma-open/milaboratories.samples-and-data.ui@1.17.1

## 1.10.0

### Minor Changes

- 363fcf0: Update dependencies

### Patch Changes

- Updated dependencies [363fcf0]
  - @platforma-open/milaboratories.samples-and-data.model@1.10.0
  - @platforma-open/milaboratories.samples-and-data.ui@1.17.0
  - @platforma-open/milaboratories.samples-and-data.workflow@1.11.0

## 1.9.11

### Patch Changes

- Updated dependencies [7051768]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.10.1

## 1.9.10

### Patch Changes

- Updated dependencies [e39205a]
  - @platforma-open/milaboratories.samples-and-data.ui@1.16.4

## 1.9.9

### Patch Changes

- e93ee43: Updated tags

## 1.9.8

### Patch Changes

- Updated dependencies [468906f]
- Updated dependencies [06a5344]
  - @platforma-open/milaboratories.samples-and-data.model@1.9.1
  - @platforma-open/milaboratories.samples-and-data.ui@1.16.3

## 1.9.7

### Patch Changes

- Updated dependencies [31a78a6]
  - @platforma-open/milaboratories.samples-and-data.ui@1.16.2

## 1.9.6

### Patch Changes

- Updated dependencies [d5a1df7]
  - @platforma-open/milaboratories.samples-and-data.ui@1.16.1

## 1.9.5

### Patch Changes

- 2661a83: chore: fix changelog

## 1.9.4

### Patch Changes

- Updated dependencies [c0b61eb]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.10.0
  - @platforma-open/milaboratories.samples-and-data.model@1.9.0
  - @platforma-open/milaboratories.samples-and-data.ui@1.16.0

## 1.9.3

### Patch Changes

- 1ff5da1: SDK upgrade
- Updated dependencies [1ff5da1]
- Updated dependencies [1ff5da1]
  - @platforma-open/milaboratories.samples-and-data.ui@1.15.0
  - @platforma-open/milaboratories.samples-and-data.model@1.8.3
  - @platforma-open/milaboratories.samples-and-data.workflow@1.9.2

## 1.9.2

### Patch Changes

- 9e94c45: chore: update marketplace score

## 1.9.1

### Patch Changes

- Updated dependencies [d775001]
  - @platforma-open/milaboratories.samples-and-data.ui@1.14.0

## 1.9.0

### Minor Changes

- f398a4c: chore: bump version

## 1.8.8

### Patch Changes

- bd53d5f: chore: bump version

## 1.8.7

### Patch Changes

- e41f100: chore: bump version

## 1.8.6

### Patch Changes

- 0f501b9: Update ui-vue (FileDialog selection supports Ctrl on Windows/Linux)
- Updated dependencies [0f501b9]
  - @platforma-open/milaboratories.samples-and-data.ui@1.13.5

## 1.8.5

### Patch Changes

- 9cb6700: block-tools upgrade, block publication fix, mark-stable cmd

## 1.8.4

### Patch Changes

- aa1dd4e: SDK upgrade: new registry format
- Updated dependencies [aa1dd4e]
  - @platforma-open/milaboratories.samples-and-data.model@1.8.2
  - @platforma-open/milaboratories.samples-and-data.ui@1.13.4
  - @platforma-open/milaboratories.samples-and-data.workflow@1.9.1

## 1.8.3

### Patch Changes

- cdb6867: Update sdk model, ui-vue, test
- Updated dependencies [cdb6867]
- Updated dependencies [21ee8ce]
  - @platforma-open/milaboratories.samples-and-data.model@1.8.1
  - @platforma-open/milaboratories.samples-and-data.ui@1.13.3

## 1.8.2

### Patch Changes

- Updated dependencies [d142efb]
- Updated dependencies [c2545a2]
- Updated dependencies [8a0fc95]
  - @platforma-open/milaboratories.samples-and-data.ui@1.13.2

## 1.8.1

### Patch Changes

- Updated dependencies [ef21209]
  - @platforma-open/milaboratories.samples-and-data.ui@1.13.1

## 1.8.0

### Minor Changes

- ebebf39: Trace annotation in the output; SDK upgrade

### Patch Changes

- Updated dependencies [ebebf39]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.9.0
  - @platforma-open/milaboratories.samples-and-data.model@1.8.0
  - @platforma-open/milaboratories.samples-and-data.ui@1.13.0

## 1.7.1

### Patch Changes

- 20db14c: SDK upgrade, minor improvements.
- 499f85f: updated icon and package
- da1d69e: ui-vue 1.10.18
- Updated dependencies [20db14c]
- Updated dependencies [499f85f]
- Updated dependencies [da1d69e]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.8.1
  - @platforma-open/milaboratories.samples-and-data.model@1.7.1
  - @platforma-open/milaboratories.samples-and-data.ui@1.12.1

## 1.7.0

### Minor Changes

- 82e916f: Fasta datasets support + minor UX fixes

### Patch Changes

- Updated dependencies [82e916f]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.8.0
  - @platforma-open/milaboratories.samples-and-data.model@1.7.0
  - @platforma-open/milaboratories.samples-and-data.ui@1.12.0

## 1.6.7

### Patch Changes

- a6d8a0f: Fix for AGGrid and new import button icons
- Updated dependencies [a6d8a0f]
  - @platforma-open/milaboratories.samples-and-data.ui@1.11.4
  - @platforma-open/milaboratories.samples-and-data.model@1.6.2
  - @platforma-open/milaboratories.samples-and-data.workflow@1.7.8

## 1.6.6

### Patch Changes

- ead3b52: Update ui-vue (fixed File Dialog error)

## 1.6.5

### Patch Changes

- ce8663b: SDK upgrade
- Updated dependencies [ce8663b]
- Updated dependencies [ce8663b]
  - @platforma-open/milaboratories.samples-and-data.model@1.6.1
  - @platforma-open/milaboratories.samples-and-data.workflow@1.7.7
  - @platforma-open/milaboratories.samples-and-data.ui@1.11.3

## 1.6.4

### Patch Changes

- c83579f: Add marketplaceRanking 10000 (high enough)
- d824ac6: Update SDK UI
- Updated dependencies [a23294d]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.7.6

## 1.6.3

### Patch Changes

- Updated dependencies [d9b8f93]
  - @platforma-open/milaboratories.samples-and-data.ui@1.11.2

## 1.6.2

### Patch Changes

- f19fca3: Use the new AgGrid theming API
- Updated dependencies [f19fca3]
  - @platforma-open/milaboratories.samples-and-data.ui@1.11.1

## 1.6.1

### Patch Changes

- f31934a: SDK upgrade
- Updated dependencies [82307ca]
- Updated dependencies [f31934a]
  - @platforma-open/milaboratories.samples-and-data.model@1.6.0
  - @platforma-open/milaboratories.samples-and-data.ui@1.11.0
  - @platforma-open/milaboratories.samples-and-data.workflow@1.7.5

## 1.6.0

### Minor Changes

- e35d541: - improved table styles
  - moved dataset creating to a button on the Metadata page

### Patch Changes

- Updated dependencies [e35d541]
  - @platforma-open/milaboratories.samples-and-data.model@1.5.0
  - @platforma-open/milaboratories.samples-and-data.ui@1.10.0

## 1.5.3

### Patch Changes

- Updated dependencies [7e7128f]
  - @platforma-open/milaboratories.samples-and-data.ui@1.9.1

## 1.5.2

### Patch Changes

- 1233dab: SDK upgrade
- Updated dependencies [1233dab]
- Updated dependencies [1233dab]
  - @platforma-open/milaboratories.samples-and-data.ui@1.9.0
  - @platforma-open/milaboratories.samples-and-data.model@1.4.2

## 1.5.1

### Patch Changes

- Updated dependencies [611c3bf]
  - @platforma-open/milaboratories.samples-and-data.ui@1.8.1

## 1.5.0

### Minor Changes

- a0ebc60: Metadata import from table

### Patch Changes

- a0ebc60: SDK upgrade
- Updated dependencies [a0ebc60]
- Updated dependencies [a0ebc60]
  - @platforma-open/milaboratories.samples-and-data.ui@1.8.0
  - @platforma-open/milaboratories.samples-and-data.model@1.4.1
  - @platforma-open/milaboratories.samples-and-data.workflow@1.7.4

## 1.4.1

### Patch Changes

- 01ffba4: ui-vue@1.7.1 (includes fixes)

## 1.4.0

### Minor Changes

- f5b0ae2: Better file import mechanics.

### Patch Changes

- Updated dependencies [f5b0ae2]
  - @platforma-open/milaboratories.samples-and-data.model@1.4.0
  - @platforma-open/milaboratories.samples-and-data.ui@1.7.0

## 1.3.4

### Patch Changes

- c343c1e: fix for build script

## 1.3.3

### Patch Changes

- 55bcb4d: SDK upgrade & AgGrid license
- Updated dependencies [55bcb4d]
  - @platforma-open/milaboratories.samples-and-data.ui@1.6.1
  - @platforma-open/milaboratories.samples-and-data.model@1.3.1
  - @platforma-open/milaboratories.samples-and-data.workflow@1.7.2

## 1.3.2

### Patch Changes

- 5c5ef29: change the organization logo image

## 1.3.1

### Patch Changes

- f5a8f97: SDK upgrade
- Updated dependencies [f5a8f97]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.7.1

## 1.3.0

### Minor Changes

- baa9d03: migration to public SDK

### Patch Changes

- Updated dependencies [b944bf4]
- Updated dependencies [baa9d03]
  - @platforma-open/milaboratories.samples-and-data.ui@1.6.0
  - @platforma-open/milaboratories.samples-and-data.workflow@1.7.0
  - @platforma-open/milaboratories.samples-and-data.model@1.3.0

## 1.2.0

### Minor Changes

- c77f269: bulk file add and many other improvements

### Patch Changes

- Updated dependencies [c77f269]
- Updated dependencies
  - @platforma-open/milaboratories.samples-and-data.model@1.2.0
  - @platforma-open/milaboratories.samples-and-data.ui@1.5.0
  - @platforma-open/milaboratories.samples-and-data.workflow@1.6.0

## 1.1.7

### Patch Changes

- 0f0fbf2: SDK upgrade
- Updated dependencies [fe31ab8]
  - @platforma-open/milaboratories.samples-and-data.ui@1.4.1

## 1.1.6

### Patch Changes

- Updated dependencies [dcb139e]
- Updated dependencies [50e7241]
- Updated dependencies [50e7241]
  - @platforma-open/milaboratories.samples-and-data.ui@1.4.0
  - @platforma-open/milaboratories.samples-and-data.workflow@1.5.0

## 1.1.5

### Patch Changes

- 16806b1: Fix for export spec & SDK upgrades
- aacaa26: SDK Upgrade
- Updated dependencies [16806b1]
- Updated dependencies [aacaa26]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.4.2
  - @platforma-open/milaboratories.samples-and-data.model@1.1.1
  - @platforma-open/milaboratories.samples-and-data.ui@1.3.2

## 1.1.4

### Patch Changes

- Updated dependencies [98a5578]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.4.1
  - @platforma-open/milaboratories.samples-and-data.ui@1.3.1

## 1.1.3

### Patch Changes

- Updated dependencies [6ca9efb]
- Updated dependencies [bc952ca]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.4.0

## 1.1.2

### Patch Changes

- Updated dependencies [35b5cf6]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.3.0

## 1.1.1

### Patch Changes

- Updated dependencies [a333776]
  - @platforma-open/milaboratories.samples-and-data.workflow@1.2.0

## 1.1.0

### Minor Changes

- 01e65cb: Initial release.

### Patch Changes

- Updated dependencies [01e65cb]
  - @platforma-open/milaboratories.samples-and-data.model@1.1.0
  - @platforma-open/milaboratories.samples-and-data.ui@1.3.0
  - @platforma-open/milaboratories.samples-and-data.workflow@1.1.0
