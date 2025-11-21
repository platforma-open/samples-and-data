import type { ImportFileHandle, PlId } from '@platforma-sdk/model';
export type { PlId } from '@platforma-sdk/model';

/** *****  Metadata *******/

export type MTValueTypeLong = 'Long';
export type MTValueTypeDouble = 'Double';
export type MTValueTypeString = 'String';

export interface MTColumnInfo {
  /**
    * Id of the metadata column, that is assigned when column is created and never changes.
    * Value of this field will also used in resulting PColumn domain, if global option is false.
    * If global is set to true, normalized label will be used.
    */
  id: string;
  /**
    * Human readable name of the metadata column.
    * Value of this field will be used in resulting PColumn domain, if global option is true.
    * String normalization proceduyre will be applied before setting the domain.
    */
  label: string;
  /**
    * Regulates identifier derivation, see description of the fields above.
    */
  global: boolean;
}

export interface MTDataDouble {
  valueType: MTValueTypeDouble;
  data: Record<PlId, number>;
}

export interface MTDataLong {
  valueType: MTValueTypeLong;
  data: Record<PlId, number>;
}

export interface MTDataString {
  valueType: MTValueTypeString;
  data: Record<PlId, string>;
}

export type MTColumn = (MTDataDouble | MTDataLong | MTDataString) & MTColumnInfo;
export type MTValueType = MTColumn['valueType'];

export interface IDSContent {
  gzipped: boolean;
}

/// --------------- Per Sample Datasets --------------- ///

/** Datasets that have data per sample */
export interface WithPerSampleData<T> extends IDSContent {
  // sample -> data
  data: Record<PlId, T>;
}

export type ReadIndex = 'R1' | 'R2' | 'I1' | 'I2';
export type ReadIndices = ReadIndex[];
export type FastqFileGroup = Partial<Record<ReadIndex, ImportFileHandle>>;

export interface DSContentFastq extends WithPerSampleData<FastqFileGroup> {
  type: 'Fastq';
  readIndices: ReadIndex[];
}

/* null means sample is added to the dataset, but file is not yet set */
export interface DSContentFasta extends WithPerSampleData<ImportFileHandle | null> {
  type: 'Fasta';
}

export type Lane = string;

export interface DSContentMultilaneFastq extends WithPerSampleData<Record<Lane, FastqFileGroup>> {
  type: 'MultilaneFastq';
  readIndices: ReadIndex[];
}

export interface TaggedDatasetRecord {
  lane?: string;
  tags: Record<string, string>;
  files: FastqFileGroup;
}

export interface DSContentTaggedFastq extends WithPerSampleData<TaggedDatasetRecord[]> {
  type: 'TaggedFastq';
  readIndices: ReadIndex[];
  hasLanes: boolean;
  tags: string[];
}

/* null means sample is added to the dataset, but file is not yet set */
export interface DSContentXsv extends WithPerSampleData<ImportFileHandle | null> {
  type: 'Xsv';
  xsvType: 'csv' | 'tsv';
}

export interface TaggedXsvDatasetRecord {
  tags: Record<string, string>;
  file: ImportFileHandle;
}

export interface DSContentTaggedXsv extends WithPerSampleData<TaggedXsvDatasetRecord[]> {
  type: 'TaggedXsv';
  xsvType: 'csv' | 'tsv';
  tags: string[];
}

export type CellRangerMtxRole = 'matrix.mtx' | 'features.tsv' | 'barcodes.tsv';
export type CellRangerMtxFileGroup = Partial<Record<CellRangerMtxRole, ImportFileHandle>>;

export interface DSContentCellRangerMtx extends WithPerSampleData<CellRangerMtxFileGroup> {
  type: 'CellRangerMTX';
}

export interface DSContentH5ad extends WithPerSampleData<ImportFileHandle | null> {
  type: 'H5AD';
}

export interface DSContentH5 extends WithPerSampleData<ImportFileHandle | null> {
  type: 'H5';
}

export interface DSContentSeurat extends WithPerSampleData<ImportFileHandle | null> {
  type: 'Seurat';
}

/// --------------- Grouped Datasets --------------- ///

/** Datasets that have data per sample */
export interface WithSampleGroupsData<T> extends IDSContent {
  // group -> data
  data: Record<PlId, T>;
  // group -> sampleId in dataset -> sample name in the file
  sampleGroups: Record<PlId, Record<PlId, string>> | undefined;
  // group id -> group name
  groupLabels: Record<PlId, string>;
}

export interface DSContentBulkCountMatrix extends WithSampleGroupsData<ImportFileHandle | null> {
  type: 'BulkCountMatrix';
  xsvType: 'csv' | 'tsv';
}

export interface DSContentMultiplexedFastq extends WithSampleGroupsData<FastqFileGroup> {
  type: 'MultiplexedFastq';
  readIndices: ReadIndex[];
}

export interface DSContentMultiSampleH5ad extends WithSampleGroupsData<ImportFileHandle | null> {
  type: 'MultiSampleH5AD';
  sampleColumnName?: string;
}

export interface DSContentMultiSampleSeurat extends WithSampleGroupsData<ImportFileHandle | null> {
  type: 'MultiSampleSeurat';
  sampleColumnName?: string;
}

/// --------------- End of Datasets --------------- ///

export type DSContent =
  | DSContentFastq
  | DSContentMultilaneFastq
  | DSContentTaggedFastq
  | DSContentFasta
  | DSContentXsv
  | DSContentTaggedXsv
  | DSContentBulkCountMatrix
  | DSContentCellRangerMtx
  | DSContentMultiplexedFastq
  | DSContentH5ad
  | DSContentH5
  | DSContentSeurat
  | DSContentMultiSampleH5ad
  | DSContentMultiSampleSeurat;

export interface Dataset<ContentType> {
  id: PlId;
  label: string;
  content: ContentType;
}

export type DSAny = Dataset<DSContent>;
export type DSFasta = Dataset<DSContentFasta>;
export type DSFastq = Dataset<DSContentFastq>;
export type DSMultilaneFastq = Dataset<DSContentMultilaneFastq>;
export type DSTaggedFastq = Dataset<DSContentTaggedFastq>;
export type DSXsv = Dataset<DSContentXsv>;
export type DSTaggedXsv = Dataset<DSContentTaggedXsv>;
export type DSCellRangerMtx = Dataset<DSContentCellRangerMtx>;
export type DSBulkCountMatrix = Dataset<DSContentBulkCountMatrix>;
export type DSMultiplexedFastq = Dataset<DSContentMultiplexedFastq>;
export type DSH5ad = Dataset<DSContentH5ad>;
export type DSH5 = Dataset<DSContentH5>;
export type DSSeurat = Dataset<DSContentSeurat>;
export type DSMultiSampleH5ad = Dataset<DSContentMultiSampleH5ad>;
export type DSMultiSampleSeurat = Dataset<DSContentMultiSampleSeurat>;

export type DSType = DSAny['content']['type'];

export type DSGrouped = DSBulkCountMatrix | DSMultiSampleH5ad | DSMultiplexedFastq | DSMultiSampleSeurat;

export function isGroupedDataset(ds: DSAny): ds is DSGrouped {
  return ds.content.type === 'BulkCountMatrix' || ds.content.type === 'MultiSampleH5AD' || ds.content.type === 'MultiplexedFastq' || ds.content.type === 'MultiSampleSeurat';
}

export interface BlockArgs {
  blockTitle?: string;
  sampleIds: PlId[];
  sampleLabelColumnLabel: string;
  sampleLabels: Record<PlId, string>;
  metadata: MTColumn[];
  datasets: DSAny[];
  h5adFilesToPreprocess: ImportFileHandle[];
  seuratFilesToPreprocess: ImportFileHandle[];
}
