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
        '--sample-output',
        required=True,
        help='Path to the output CSV file with sample IDs'
    )
    parser.add_argument(
        '--column-output',
        help='Path to the output CSV file with available columns'
    )
    parser.add_argument(
        '--column',
        default='sample',
        help='Name of the column to use for sample IDs (default: sample)'
    )
    parser.add_argument(
        '--list-columns',
        action='store_true',
        help='List all available columns in anndata.obs and exit'
    )
    
    args = parser.parse_args()
    
    # If listing columns, do that and exit
    if args.list_columns:
        try:
            print(f"Reading H5AD file: {args.input}", file=sys.stderr)
            adata = anndata.read_h5ad(args.input, backed="r")
            
            # Write column names to output
            with open(args.sample_output, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                for col in adata.obs.columns:
                    writer.writerow([col])
            
            print(f"Available columns: {list(adata.obs.columns)}", file=sys.stderr)
            sys.exit(0)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
    
    try:
        # Read the H5AD file
        print(f"Reading H5AD file: {args.input}", file=sys.stderr)
        adata = anndata.read_h5ad(args.input, backed="r")
        
        # Check which column is available (case-insensitive): 'sample' or 'samples'
        supported_names = ["sample", "samples", "replicate"]
        sample_column = None
        
        # Create a case-insensitive mapping of columns
        column_map = {col.lower(): col for col in adata.obs.columns}
        
        # First try to use the provided column name
        if args.column and args.column.lower() in column_map:
            sample_column = column_map[args.column.lower()]
            print(f"Using provided column '{sample_column}'", file=sys.stderr)
        else:
            # Log warning if provided column was not found
            if args.column:
                print(f"Warning: Provided column '{args.column}' not found in anndata.obs", file=sys.stderr)
                print(f"Available columns: {list(adata.obs.columns)}", file=sys.stderr)
            
            # Fall back to checking supported names
            for name in supported_names:
                if name.lower() in column_map:
                    sample_column = column_map[name.lower()]
                    print(f"Using fallback column '{sample_column}'", file=sys.stderr)
                    break
        
        # Extract samples based on available column or use obs_names
        if sample_column is None:
            # If no column found, still create a CSV with all cell barcodes
            print(f"Warning: No supported sample column found in anndata.obs", file=sys.stderr)
            print(f"Supported column names (case-insensitive): {supported_names}", file=sys.stderr)
            print(f"Available columns: {list(adata.obs.columns)}", file=sys.stderr)
            print(f"Using cell barcodes as sample identifiers", file=sys.stderr)
            samples = list(adata.obs_names)
        else:
            # Extract unique sample IDs from the column
            samples = adata.obs[sample_column].unique().tolist()
            print(f"Found {len(samples)} unique samples in column '{sample_column}'", file=sys.stderr)
        
        # Write samples to CSV, one per line
        with open(args.sample_output, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            for sample in samples:
                writer.writerow([sample])
        
        # Also write columns.csv with all available columns in anndata.obs
        if args.column_output:
            columns_output = args.column_output
            with open(columns_output, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                for col in adata.obs.columns:
                    writer.writerow([col])
            print(f"Columns list written to: {columns_output}", file=sys.stderr)
        
        print(f"Successfully extracted {len(samples)} samples", file=sys.stderr)
        print(f"Output written to: {args.sample_output}", file=sys.stderr)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

