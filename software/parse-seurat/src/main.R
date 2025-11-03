#!/usr/bin/env Rscript
# Parse multi-sample Seurat RDS file and extract sample IDs or column values

library(SeuratObject)
library(dplyr)

# Parse command line arguments
args <- commandArgs(trailingOnly = TRUE)

# Function to parse arguments
parse_args <- function(args) {
  parsed <- list(
    input = NULL,
    sample_output = NULL,
    columns_output = NULL,
    list_columns = FALSE,
    column = NULL,
    column_names = c()
  )
  
  i <- 1
  while (i <= length(args)) {
    if (args[i] == "--input") {
      parsed$input <- args[i + 1]
      i <- i + 2
    } else if (args[i] == "--sample-output" || args[i] == "--output") {
      parsed$sample_output <- args[i + 1]
      i <- i + 2
    } else if (args[i] == "--columns-output") {
      parsed$columns_output <- args[i + 1]
      i <- i + 2
    } else if (args[i] == "--list-columns") {
      parsed$list_columns <- TRUE
      i <- i + 1
    } else if (args[i] == "--column") {
      parsed$column <- args[i + 1]
      i <- i + 2
    } else if (args[i] == "--column-names") {
      # Collect all following arguments until we hit another flag
      i <- i + 1
      while (i <= length(args) && !startsWith(args[i], "--")) {
        parsed$column_names <- c(parsed$column_names, args[i])
        i <- i + 1
      }
    } else if (args[i] == "extract-columns") {
      # This is a mode flag, ignore it
      i <- i + 1
    } else {
      i <- i + 1
    }
  }
  
  return(parsed)
}

args_parsed <- parse_args(args)

# Validate required arguments
if (is.null(args_parsed$input)) {
  stop("Error: --input is required")
}

if (is.null(args_parsed$sample_output)) {
  stop("Error: --output or --sample-output is required")
}

tryCatch({
  # Read the Seurat object
  cat(paste("Reading Seurat RDS file:", args_parsed$input, "\n"), file = stderr())
  seurat_obj <- readRDS(args_parsed$input)
  
  # Check if it's a Seurat object
  if (!inherits(seurat_obj, "Seurat")) {
    stop("Input file is not a Seurat object")
  }
  
  # Get metadata
  metadata <- seurat_obj@meta.data
  
  # Write columns if columns_output is specified
  if (!is.null(args_parsed$columns_output)) {
    cat("Writing available columns\n", file = stderr())
    
    # Write column names to output
    write.table(
      data.frame(column = colnames(metadata)),
      file = args_parsed$columns_output,
      sep = ",",
      row.names = FALSE,
      col.names = FALSE,
      quote = FALSE
    )
    
    cat(paste("Available columns:", paste(colnames(metadata), collapse = ", "), "\n"), file = stderr())
  }
  
  # List columns mode (for backward compatibility)
  if (args_parsed$list_columns) {
    cat("Listing available columns\n", file = stderr())
    
    # Write column names to output
    write.table(
      data.frame(column = colnames(metadata)),
      file = args_parsed$sample_output,
      sep = ",",
      row.names = FALSE,
      col.names = FALSE,
      quote = FALSE
    )
    
    cat(paste("Available columns:", paste(colnames(metadata), collapse = ", "), "\n"), file = stderr())
    quit(status = 0)
  }
  
  # Extract columns mode
  if (length(args_parsed$column_names) > 0) {
    cat(paste("Extracting columns:", paste(args_parsed$column_names, collapse = ", "), "\n"), file = stderr())
    
    # Get the sample column name (default to first column if not specified)
    sample_column <- if (!is.null(args_parsed$column)) args_parsed$column else colnames(metadata)[1]
    
    cat(paste("Using sample column:", sample_column, "\n"), file = stderr())
    
    # Check if sample column exists
    if (!(sample_column %in% colnames(metadata))) {
      stop(paste("Sample column", sample_column, "not found in metadata"))
    }
    
    # Check if requested columns exist
    missing_cols <- setdiff(args_parsed$column_names, colnames(metadata))
    if (length(missing_cols) > 0) {
      cat(paste("Warning: columns not found:", paste(missing_cols, collapse = ", "), "\n"), file = stderr())
    }
    
    # Extract existing columns
    existing_cols <- intersect(args_parsed$column_names, colnames(metadata))
    
    if (length(existing_cols) == 0) {
      stop("No requested columns found in metadata")
    }
    
    # Create output data frame with sample column and requested columns
    output_df <- metadata[, c(sample_column, existing_cols), drop = FALSE]
    colnames(output_df)[1] <- sample_column
    
    # Write to CSV
    write.csv(output_df, file = args_parsed$sample_output, row.names = FALSE, quote = TRUE)
    
    cat(paste("Extracted", nrow(output_df), "rows\n"), file = stderr())
    quit(status = 0)
  }
  
  # Default mode: extract sample IDs
  # Find sample column
  sample_column <- NULL
  supported_names <- c("sample", "samples", "replicate", "orig.ident")
  
  # Try provided column first
  if (!is.null(args_parsed$column) && args_parsed$column %in% colnames(metadata)) {
    sample_column <- args_parsed$column
    cat(paste("Using provided column", sample_column, "\n"), file = stderr())
  } else {
    # Try to find a matching column (case-insensitive)
    for (name in supported_names) {
      matching_cols <- grep(paste0("^", name, "$"), colnames(metadata), ignore.case = TRUE, value = TRUE)
      if (length(matching_cols) > 0) {
        sample_column <- matching_cols[1]
        cat(paste("Found sample column:", sample_column, "\n"), file = stderr())
        break
      }
    }
  }
  
  if (is.null(sample_column)) {
    # Use first column as fallback
    sample_column <- colnames(metadata)[1]
    cat(paste("Warning: No standard sample column found. Using first column:", sample_column, "\n"), file = stderr())
  }
  
  # Get unique sample IDs
  sample_ids <- unique(as.character(metadata[[sample_column]]))
  sample_ids <- sort(sample_ids)
  
  cat(paste("Found", length(sample_ids), "unique samples\n"), file = stderr())
  
  # Write to CSV
  write.table(
    data.frame(sample = sample_ids),
    file = args_parsed$sample_output,
    sep = ",",
    row.names = FALSE,
    col.names = FALSE,
    quote = FALSE
  )
  
  cat("Sample extraction completed successfully\n", file = stderr())
  
}, error = function(e) {
  cat(paste("Error:", conditionMessage(e), "\n"), file = stderr())
  quit(status = 1)
})


