#!/usr/bin/env python3
"""
Parse multi-sample H5AD file and extract sample IDs or column values.
"""

import argparse
import csv
import sys
import anndata
import pandas as pd


def parse_file_mode(args):
    """Original mode: extract sample IDs from H5AD file."""
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


def extract_columns_mode(args):
    """New mode: extract specified column values for each sample."""
    try:
        # Read the H5AD file (without backed mode for proper DataFrame operations)
        print(f"Reading H5AD file: {args.input}", file=sys.stderr)
        adata = anndata.read_h5ad(args.input)

        # Validate sample column exists
        available_columns = list(adata.obs.columns)
        if args.column not in available_columns:
            print(f"Error: Sample column '{args.column}' not found in anndata.obs", file=sys.stderr)
            print(f"Available columns: {available_columns}", file=sys.stderr)
            sys.exit(1)

        # Validate requested columns exist
        missing_columns = [col for col in args.column_names if col not in available_columns]

        if missing_columns:
            print(f"Error: The following columns were not found in anndata.obs: {missing_columns}", file=sys.stderr)
            print(f"Available columns: {available_columns}", file=sys.stderr)
            sys.exit(1)

        # Get unique samples from the specified column
        print(f"Using column '{args.column}' to identify samples", file=sys.stderr)
        unique_samples = adata.obs[args.column].unique()
        print(f"Found {len(unique_samples)} unique samples", file=sys.stderr)

        # Extract the requested columns for each unique sample
        print(f"Extracting columns: {args.column_names}", file=sys.stderr)

        # Convert obs to a proper pandas DataFrame and include the sample column
        obs_df = pd.DataFrame(adata.obs[[args.column] + args.column_names])

        # Group by sample and get the first value for each column
        # (assuming metadata is consistent across cells of the same sample)
        grouped_data = obs_df.groupby(args.column)[args.column_names].first()

        # Reset index to make sample column a regular column
        grouped_data = grouped_data.reset_index()

        # Detect types and rename columns with type suffixes
        def map_dtype_to_type(dtype):
            """Map pandas dtype to Long/Double/String."""
            if pd.api.types.is_integer_dtype(dtype):
                return "Long"
            elif pd.api.types.is_float_dtype(dtype):
                return "Double"
            else:
                return "String"

        # Rename all columns (including sample column) with type information
        new_column_names = {}
        for col in grouped_data.columns:
            dtype = grouped_data[col].dtype
            type_str = map_dtype_to_type(dtype)
            new_column_names[col] = f"{col}:{type_str}"
            print(f"Column '{col}' detected as {dtype} -> {type_str}", file=sys.stderr)

        grouped_data = grouped_data.rename(columns=new_column_names)

        # Write to CSV
        grouped_data.to_csv(args.output, index=False)

        print(f"Successfully extracted {len(grouped_data)} samples and {len(args.column_names)} columns", file=sys.stderr)
        print(f"Output written to: {args.output}", file=sys.stderr)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Parse H5AD files: extract sample IDs or column values'
    )
    subparsers = parser.add_subparsers(dest='mode', required=True, help='Operation mode')

    # parse-file subcommand (original functionality)
    parse_parser = subparsers.add_parser(
        'parse-file',
        help='Extract sample IDs from multi-sample H5AD file'
    )
    parse_parser.add_argument(
        '--input',
        required=True,
        help='Path to the H5AD file to parse'
    )
    parse_parser.add_argument(
        '--sample-output',
        required=True,
        help='Path to the output CSV file with sample IDs'
    )
    parse_parser.add_argument(
        '--column-output',
        help='Path to the output CSV file with available columns'
    )
    parse_parser.add_argument(
        '--column',
        default='sample',
        help='Name of the column to use for sample IDs (default: sample)'
    )
    parse_parser.add_argument(
        '--list-columns',
        action='store_true',
        help='List all available columns in anndata.obs and exit'
    )

    # extract-columns subcommand (new functionality)
    extract_parser = subparsers.add_parser(
        'extract-columns',
        help='Extract specified column values from H5AD file'
    )
    extract_parser.add_argument(
        '--input',
        required=True,
        help='Path to the H5AD file to read'
    )
    extract_parser.add_argument(
        '--output',
        required=True,
        help='Path to the output CSV file'
    )
    extract_parser.add_argument(
        '--column',
        required=True,
        help='Name of the column to use for sample identification'
    )
    extract_parser.add_argument(
        '--column-names',
        nargs='+',
        required=True,
        help='Names of columns to extract from anndata.obs (space-separated)'
    )

    args = parser.parse_args()

    # Route to appropriate mode handler
    if args.mode == 'parse-file':
        parse_file_mode(args)
    elif args.mode == 'extract-columns':
        extract_columns_mode(args)


def extract_columns_mode(args):
    """New mode: extract specified column values for each sample."""
    try:
        # Read the H5AD file (without backed mode for proper DataFrame operations)
        print(f"Reading H5AD file: {args.input}", file=sys.stderr)
        adata = anndata.read_h5ad(args.input)

        # Validate sample column exists
        available_columns = list(adata.obs.columns)
        if args.column not in available_columns:
            print(f"Error: Sample column '{args.column}' not found in anndata.obs", file=sys.stderr)
            print(f"Available columns: {available_columns}", file=sys.stderr)
            sys.exit(1)

        # Validate requested columns exist
        missing_columns = [col for col in args.column_names if col not in available_columns]

        if missing_columns:
            print(f"Error: The following columns were not found in anndata.obs: {missing_columns}", file=sys.stderr)
            print(f"Available columns: {available_columns}", file=sys.stderr)
            sys.exit(1)

        # Get unique samples from the specified column
        print(f"Using column '{args.column}' to identify samples", file=sys.stderr)
        unique_samples = adata.obs[args.column].unique()
        print(f"Found {len(unique_samples)} unique samples", file=sys.stderr)

        # Extract the requested columns for each unique sample
        print(f"Extracting columns: {args.column_names}", file=sys.stderr)

        # Convert obs to a proper pandas DataFrame and include the sample column
        obs_df = pd.DataFrame(adata.obs[[args.column] + args.column_names])

        # Group by sample and get the first value for each column
        # (assuming metadata is consistent across cells of the same sample)
        grouped_data = obs_df.groupby(args.column)[args.column_names].first()

        # Reset index to make sample column a regular column
        grouped_data = grouped_data.reset_index()

        # Detect types and rename columns with type suffixes
        def map_dtype_to_type(dtype):
            """Map pandas dtype to Long/Double/String."""
            if pd.api.types.is_integer_dtype(dtype):
                return "Long"
            elif pd.api.types.is_float_dtype(dtype):
                return "Double"
            else:
                return "String"

        # Rename all columns (including sample column) with type information
        new_column_names = {}
        for col in grouped_data.columns:
            dtype = grouped_data[col].dtype
            type_str = map_dtype_to_type(dtype)
            new_column_names[col] = f"{col}:{type_str}"
            print(f"Column '{col}' detected as {dtype} -> {type_str}", file=sys.stderr)

        grouped_data = grouped_data.rename(columns=new_column_names)

        # Write to CSV
        grouped_data.to_csv(args.output, index=False)

        print(f"Successfully extracted {len(grouped_data)} samples and {len(args.column_names)} columns", file=sys.stderr)
        print(f"Output written to: {args.output}", file=sys.stderr)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Parse H5AD files: extract sample IDs or column values'
    )
    subparsers = parser.add_subparsers(dest='mode', required=True, help='Operation mode')

    # parse-file subcommand (original functionality)
    parse_parser = subparsers.add_parser(
        'parse-file',
        help='Extract sample IDs from multi-sample H5AD file'
    )
    parse_parser.add_argument(
        '--input',
        required=True,
        help='Path to the H5AD file to parse'
    )
    parse_parser.add_argument(
        '--sample-output',
        required=True,
        help='Path to the output CSV file with sample IDs'
    )
    parse_parser.add_argument(
        '--column-output',
        help='Path to the output CSV file with available columns'
    )
    parse_parser.add_argument(
        '--column',
        default='sample',
        help='Name of the column to use for sample IDs (default: sample)'
    )
    parse_parser.add_argument(
        '--list-columns',
        action='store_true',
        help='List all available columns in anndata.obs and exit'
    )

    # extract-columns subcommand (new functionality)
    extract_parser = subparsers.add_parser(
        'extract-columns',
        help='Extract specified column values from H5AD file'
    )
    extract_parser.add_argument(
        '--input',
        required=True,
        help='Path to the H5AD file to read'
    )
    extract_parser.add_argument(
        '--output',
        required=True,
        help='Path to the output CSV file'
    )
    extract_parser.add_argument(
        '--column',
        required=True,
        help='Name of the column to use for sample identification'
    )
    extract_parser.add_argument(
        '--column-names',
        nargs='+',
        required=True,
        help='Names of columns to extract from anndata.obs (space-separated)'
    )

    args = parser.parse_args()

    # Route to appropriate mode handler
    if args.mode == 'parse-file':
        parse_file_mode(args)
    elif args.mode == 'extract-columns':
        extract_columns_mode(args)


if __name__ == '__main__':
    main()

