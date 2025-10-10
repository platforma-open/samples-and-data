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

/** *****  Datasets *******/

export type ReadIndex = 'R1' | 'R2' | 'I1' | 'I2';
export type ReadIndices = ReadIndex[];
export const AllReadIndices: ReadIndex[] = ['R1', 'R2', 'I1', 'I2'];

export type FastqFileGroup = Partial<Record<ReadIndex, ImportFileHandle>>;

export interface DSContentFastq {
  type: 'Fastq';
  gzipped: boolean;
  readIndices: ReadIndex[];
  data: Record<PlId, FastqFileGroup>;
}

export interface DSContentFasta {
  type: 'Fasta';
  gzipped: boolean;
  data: Record<PlId, ImportFileHandle | null>; /* null means sample is added to the dataset, but file is not yet set */
}

export type Lane = string;

export interface DSContentMultilaneFastq {
  type: 'MultilaneFastq';
  gzipped: boolean;
  readIndices: ReadIndex[];
  data: Record<PlId, Record<Lane, FastqFileGroup>>;
}

export interface TaggedDatasetRecord {
  lane?: string;
  tags: Record<string, string>;
  files: FastqFileGroup;
}

export interface DSContentTaggedFastq {
  type: 'TaggedFastq';
  gzipped: boolean;
  readIndices: ReadIndex[];
  hasLanes: boolean;
  tags: string[];
  data: Record<PlId, TaggedDatasetRecord[]>;
}

export interface DSContentXsv {
  type: 'Xsv';
  gzipped: boolean;
  xsvType: 'csv' | 'tsv';
  data: Record<PlId, ImportFileHandle | null>; /* null means sample is added to the dataset, but file is not yet set */
}

export interface DSContentCloneTable {
  type: 'CloneTable';
  gzipped: boolean;
  xsvType: 'csv' | 'tsv';
  data: Record<PlId, ImportFileHandle | null>; /* null means sample is added to the dataset, but file is not yet set */
}

export interface TaggedXsvDatasetRecord {
  tags: Record<string, string>;
  file: ImportFileHandle;
}

export interface DSContentTaggedXsv {
  type: 'TaggedXsv';
  gzipped: boolean;
  xsvType: 'csv' | 'tsv';
  tags: string[];
  data: Record<PlId, TaggedXsvDatasetRecord[]>;
}

export type DSContent =
  | DSContentFastq
  | DSContentMultilaneFastq
  | DSContentTaggedFastq
  | DSContentFasta
  | DSContentXsv
  | DSContentTaggedXsv;

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

export type DSType = DSAny['content']['type'];

export interface BlockArgs {
  blockTitle?: string;
  sampleIds: PlId[];
  sampleLabelColumnLabel: string;
  sampleLabels: Record<PlId, string>;
  metadata: MTColumn[];
  datasets: DSAny[];
}
