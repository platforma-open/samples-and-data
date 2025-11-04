# Parse H5AD software

This package contains Python scripts for processing H5AD files.

## Scripts

### main.py

Processes H5AD files with two operation modes:

#### Mode 1: parse-file

Extracts sample IDs from multi-sample H5AD files.

**Usage:**
```bash
python main.py parse-file --input <input.h5ad> --sample-output <samples.csv> [--column <column_name>] [--column-output <columns.csv>] [--list-columns]
```

**Arguments:**
- `--input`: Path to the H5AD file to parse
- `--sample-output`: Path to the output CSV file with sample IDs
- `--column`: Name of the column to use for sample IDs (default: `sample`)
- `--column-output`: Path to the output CSV file with available columns (optional)
- `--list-columns`: List all available columns in anndata.obs and exit

**Behavior:**
- Looks for sample identifier columns (case-insensitive): `sample`, `samples`, `replicate`, or `replicates`
- Falls back to cell barcodes if no supported column is found
- Outputs one sample ID per line in CSV format

**Output:**
- CSV file with one sample ID per line
- Optionally, a second CSV file listing all available columns in anndata.obs

#### Mode 2: extract-columns

Extracts specified column values from H5AD files for each unique sample.

**Usage:**
```bash
python main.py extract-columns --input <input.h5ad> --output <output.csv> --column <sample_column> --column-names <col1> <col2> ...
```

**Arguments:**
- `--input`: Path to the H5AD file to read
- `--output`: Path to the output CSV file
- `--column`: Name of the column to use for sample identification (required)
- `--column-names`: Names of columns to extract from anndata.obs (space-separated)

**Behavior:**
- Groups cells by the specified sample column
- Extracts the first value for each requested column per sample
- Automatically detects column types (Long, Double, or String)
- Adds type suffixes to column names (e.g., `age:Long`, `weight:Double`, `condition:String`)

**Output:**
- CSV file with one row per unique sample
- Columns include the sample identifier and all requested columns with type annotations

## Requirements

See `requirements.txt` for dependencies.
