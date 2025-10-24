#!/usr/bin/env python3
"""
Parse multi-sample H5AD file and extract sample IDs.
"""

import argparse
import csv
import sys
import anndata


def main():
    parser = argparse.ArgumentParser(
        description='Extract sample IDs from multi-sample H5AD file'
    )
    parser.add_argument(
        '--input',
        required=True,
        help='Path to the H5AD file to parse'
    )
    parser.add_argument(
        '--output',
        required=True,
        help='Path to the output CSV file with sample IDs'
    )
    
    args = parser.parse_args()
    
    try:
        # Read the H5AD file
        print(f"Reading H5AD file: {args.input}", file=sys.stderr)
        adata = anndata.read_h5ad(args.input)
        
        # Check which column is available (case-insensitive): 'sample' or 'samples'
        supported_names = ["sample", "samples"]
        sample_column = None
        
        # Create a case-insensitive mapping of columns
        column_map = {col.lower(): col for col in adata.obs.columns}
        
        # Find the first matching column name
        for name in supported_names:
            if name.lower() in column_map:
                sample_column = column_map[name.lower()]
                break
        
        if sample_column is None:
            print(f"Error: No supported sample column found in anndata.obs", file=sys.stderr)
            print(f"Supported column names (case-insensitive): {supported_names}", file=sys.stderr)
            print(f"Available columns: {list(adata.obs.columns)}", file=sys.stderr)
            sys.exit(1)
        
        # Extract unique sample IDs
        samples = adata.obs[sample_column].unique().tolist()
        
        print(f"Found {len(samples)} unique samples in column '{sample_column}'", file=sys.stderr)
        
        # Write samples to CSV, one per line
        with open(args.output, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            for sample in samples:
                writer.writerow([sample])
        
        print(f"Successfully extracted {len(samples)} samples", file=sys.stderr)
        print(f"Output written to: {args.output}", file=sys.stderr)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

