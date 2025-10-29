#!/usr/bin/env python3
"""
Split a multi-sample H5AD file into a per-sample H5AD file.
"""

import argparse
import sys
import anndata


def main():
    parser = argparse.ArgumentParser(
        description='Split a multi-sample H5AD file into a per-sample H5AD file'
    )
    parser.add_argument(
        '--input',
        required=True,
        help='Path to the input H5AD file'
    )
    parser.add_argument(
        '--output',
        required=True,
        help='Path to the output H5AD file for the selected sample'
    )
    parser.add_argument(
        '--sample-name',
        required=True,
        help='Name of the sample to extract'
    )
    parser.add_argument(
        '--sample-column',
        default='sample',
        help='Name of the column in anndata.obs containing sample IDs (default: sample)'
    )
    
    args = parser.parse_args()
    
    try:
        # Read the H5AD file
        print(f"Reading H5AD file: {args.input}", file=sys.stderr)
        adata = anndata.read_h5ad(args.input)
        
        # Check which column is available (case-insensitive)
        column_map = {col.lower(): col for col in adata.obs.columns}
        
        sample_column = None
        if args.sample_column.lower() in column_map:
            sample_column = column_map[args.sample_column.lower()]
            print(f"Using sample column '{sample_column}'", file=sys.stderr)
        else:
            print(f"Error: Sample column '{args.sample_column}' not found in anndata.obs", file=sys.stderr)
            print(f"Available columns: {list(adata.obs.columns)}", file=sys.stderr)
            sys.exit(1)
        
        # Get unique samples in the column
        unique_samples = adata.obs[sample_column].unique().tolist()
        print(f"Found {len(unique_samples)} unique samples in column '{sample_column}'", file=sys.stderr)
        print(f"Samples: {unique_samples}", file=sys.stderr)
        
        # Check if the requested sample exists
        if args.sample_name not in unique_samples:
            print(f"Error: Sample '{args.sample_name}' not found in column '{sample_column}'", file=sys.stderr)
            print(f"Available samples: {unique_samples}", file=sys.stderr)
            sys.exit(1)
        
        # Filter to only the requested sample
        print(f"Extracting sample '{args.sample_name}'", file=sys.stderr)
        sample_mask = adata.obs[sample_column] == args.sample_name
        adata_subset = adata[sample_mask].copy()
        
        print(f"Sample contains {adata_subset.n_obs} observations", file=sys.stderr)
        
        # Write the subset to a new H5AD file
        print(f"Writing output to: {args.output}", file=sys.stderr)
        adata_subset.write_h5ad(args.output)
        
        print(f"Successfully created per-sample H5AD file for '{args.sample_name}'", file=sys.stderr)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

