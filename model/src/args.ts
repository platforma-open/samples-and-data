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

/// --------------- Grouped Datasets --------------- ///

/** Datasets that have data per sample */
export interface WithSampleGroupsData<T> extends IDSContent {
  // group -> data
  data: Record<PlId, T>;
  // group -> samples
  sampleGroups: Record<PlId, PlId[]> | undefined;
}

export interface DSContentBulkCountMatrix extends WithSampleGroupsData<ImportFileHandle | null> {
  type: 'BulkCountMatrix';
  xsvType: 'csv' | 'tsv';
}

/// --------------- End of Datasets --------------- ///

export type DSContent =
  | DSContentFastq
  | DSContentMultilaneFastq
  | DSContentTaggedFastq
  | DSContentFasta
  | DSContentXsv
  | DSContentTaggedXsv
  | DSContentBulkCountMatrix;

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
export type DSBulkCountMatrix = Dataset<DSContentBulkCountMatrix>;

export type DSType = DSAny['content']['type'];

export function isGroupedDataset(ds: DSAny): boolean {
  return ds.content.type === 'BulkCountMatrix';
}

export interface BlockArgs {
  blockTitle?: string;
  sampleIds: PlId[];
  sampleLabelColumnLabel: string;
  sampleLabels: Record<PlId, string>;
  groupIds: PlId[];
  groupLabels: Record<PlId, string>;
  metadata: MTColumn[];
  datasets: DSAny[];
}
