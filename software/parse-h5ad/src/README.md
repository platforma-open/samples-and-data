# Samples and Data Software

This package contains Python scripts for processing sample and data files.

## Scripts

### parse-h5ad.py

Extracts sample IDs from multi-sample H5AD files.

**Usage:**
```bash
python parse-h5ad.py --input <input.h5ad> --output <samples.csv>
```

**Arguments:**
- `--input`: Path to the H5AD file to parse
- `--output`: Path to the output CSV file with sample IDs (one per line)

**Output:**
CSV file with one sample ID per line.

