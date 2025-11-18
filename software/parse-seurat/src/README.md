# Parse Seurat RDS

R-based parser for Seurat RDS files to extract sample information and metadata.

## Usage

### Extract sample IDs and columns in one call

```bash
Rscript main.R --input <input.rds> --output <samples.csv> --columns-output <columns.csv>
```

### Extract sample IDs only

```bash
Rscript main.R --input <input.rds> --output <samples.csv>
```

### List available columns (backward compatibility)

```bash
Rscript main.R --input <input.rds> --output <columns.csv> --list-columns
```

### Extract specific columns

```bash
Rscript main.R extract-columns --input <input.rds> --output <metadata.csv> --column sample --column-names column1 column2 column3
```

## Arguments

- `--input`: Path to input Seurat RDS file
- `--output` or `--sample-output`: Path to output CSV file for samples
- `--columns-output`: Path to output CSV file for columns (optional, enables combined mode)
- `--list-columns`: List all available columns in the metadata (backward compatibility)
- `--column`: Sample column name to use (default: auto-detect)
- `--column-names`: List of column names to extract (for extract-columns mode)

## Requirements

- R >= 4.4.2
- SeuratObject package
- dplyr package

