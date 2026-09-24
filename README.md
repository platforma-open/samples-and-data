# Samples & Data

The starting point of a Platforma project. This block imports your raw data — sequencing reads, count matrices, single-cell objects, tabular results — organizes it into named datasets, and attaches the sample metadata every downstream analysis groups and compares by.

Open-source analysis block for Platforma, the biologics discovery platform by MiLaboratories. For the full no-code workflow, see [platforma.bio](https://platforma.bio/).

## What it does

In most projects this is the first block you add. Everything downstream reads from it, so it does two jobs: it gets files into the project as structured datasets, and it records what each sample *is*.

**Datasets** group files by type and map them to samples. A project can hold several, so paired-end FASTQ from one run, a count matrix from another, and a single-cell object from a third can coexist and be analyzed together. Supported types cover raw reads (FASTQ, including multi-lane, multiplexed, and tagged layouts; FASTA), expression data (bulk count matrices, Cell Ranger MTX, H5, H5AD and multisample H5AD, Seurat RDS and multisample RDS), and tabular results (per-sample CSV/TSV, tagged per-sample CSV/TSV). File-to-sample mapping is driven by a pattern you define, so consistent naming conventions are read automatically instead of assigned by hand.

Multiplexed data is handled at import: multiplexing rules and barcode columns split pooled files into per-sample data, so demultiplexing does not have to happen outside the platform first. Tagged dataset types carry additional per-file tags through to analysis.

**Metadata** is the other half. Import a metadata table and map its columns — sample ID, sample name, file ID, barcode — or enter values directly. Those columns become the grouping variables downstream: the condition column an enrichment analysis compares across, the donor column SHM trees build within, the covariates a differential expression compares by. Getting metadata in here means every later block can use it without re-entry.

Import problems surface as **file issues** rather than failing silently, so a missing mate file or an unmatched pattern is visible while you are still setting the project up.

## Inputs & outputs

* **Input:** raw or processed data files — FASTQ (single, paired, multi-lane, multiplexed, tagged), FASTA, bulk count matrices, Cell Ranger MTX, H5, H5AD, multisample H5AD, Seurat RDS, multisample Seurat RDS, per-sample CSV/TSV — plus a metadata table or directly entered metadata.
* **Output:** one or more named datasets mapped to samples, with sample metadata attached, consumable by every upstream analysis block.

## Specifications

| | |
|---|---|
| Block title in app | Samples & Data |
| Read data | FASTQ, multi-lane FASTQ, multiplexed FASTQ, tagged FASTQ, FASTA — gzipped supported |
| Expression data | Bulk count matrix, Cell Ranger MTX, H5, H5AD, multisample H5AD, Seurat RDS, multisample Seurat RDS |
| Tabular data | Per-sample CSV/TSV, tagged per-sample CSV/TSV |
| Sample mapping | Pattern-based file-to-sample matching; sample ID, sample name, file ID, and barcode columns |
| Multiplexing | Multiplexing rules and barcode columns for splitting pooled files |
| Metadata | Imported from a table or entered directly; becomes grouping variables downstream |
| Datasets per block | Multiple, each independently typed and named |

## Use cases

* **Project setup:** import a sequencing run and define the samples before any analysis begins.
* **Metadata-driven analysis:** attach condition, timepoint, donor, and treatment columns so downstream blocks can group and compare by them.
* **Multiplexed libraries:** split pooled FASTQ into per-sample data at import, using barcodes and multiplexing rules.
* **Multi-run studies:** hold several datasets in one project so runs sequenced separately are analyzed together.
* **Single-cell projects:** import Cell Ranger output, H5AD, or Seurat objects alongside raw reads.
* **Reanalysis:** bring in existing count matrices or per-sample tables without reprocessing raw data.
* **Import QC:** catch unmatched files and missing mates at setup, before they surface as confusing errors mid-analysis.

## FAQ

### What should I do first in a new project?

Add this block, create a dataset of the right type for your files, and define the pattern that maps files to samples. Then import or enter metadata. Everything else in the project reads from here.

### Can one project hold more than one dataset?

Yes. Add as many datasets as you need, each with its own type and name — useful when a project combines raw reads, expression data, and tabular results, or when several sequencing runs are analyzed together.

### How does file-to-sample mapping work?

Through a pattern you define over the filenames. Consistent naming conventions are read automatically, so samples do not have to be assigned file by file.

### Do I need to demultiplex before importing?

No. Configure multiplexing rules and a barcode column and pooled files are split into per-sample data during import.

### Why does metadata matter so much?

Because it is what downstream analysis groups by. An enrichment analysis needs a condition column; SHM trees need a donor column; differential expression needs the comparison variable. Entering metadata once here makes it available to every block instead of being re-specified each time.

### What are file issues?

Import problems reported rather than hidden — an unmatched pattern, a missing read mate, a file that does not fit its dataset type. They appear during setup so they can be fixed before analysis runs.

## Part of the Platforma ecosystem

This block is part of [Platforma](https://platforma.bio/) by [MiLaboratories](https://github.com/milaboratory). Explore the other open-source blocks at [github.com/platforma-open](https://github.com/platforma-open) and the documentation at [docs.platforma.bio](https://docs.platforma.bio/).
