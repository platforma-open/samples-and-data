import type { ImportFileHandle, PlId } from '@platforma-sdk/model';

/**
 * Metadata column meta data.
 */
export interface MetadataColumnMeta {
  /**
   * Id of the metadata column, that is assigned when column is created and never changes.
   * Value of this field will also used in resulting PColumn domain, if global option is false.
   * If global is set to true, normalized label will be used.
   */
  id: string;
  /**
   * Human readable name of the metadata column.
   * Value of this field will be used in resulting PColumn domain, if global option is true.
   * String normalization procedure will be applied before setting the domain.
   */
  label: string;
  /**
   * Regulates identifier derivation, see description of the fields above.
   */
  global: boolean;
}

/**
 * Metadata data for double values.
 */
export interface MetadataDataDouble {
  valueType: 'Double';
  data: Record<PlId, number | undefined>;
}

/**
 * Metadata data for long values.
 */
export interface MetadataDataLong {
  valueType: 'Long';
  data: Record<PlId, number | undefined>;
}

/**
 * Metadata data for string values.
 */
export interface MetadataDataString {
  valueType: 'String';
  data: Record<PlId, string | undefined>;
}

/**
 * Metadata column.
 */
export type MetadataColumn = (MetadataDataDouble | MetadataDataLong | MetadataDataString) &
  MetadataColumnMeta;

export type MetadataColumnValueType = MetadataColumn['valueType'];

/**
 * Fasta dataset content.
 */
export interface DatasetContentFasta {
  type: 'Fasta';
  gzipped: boolean;
  data: Partial<Record<
    PlId,
    ImportFileHandle | null
    /* null mean sample is added to the dataset, but file is not yet set */
  >>;
}

/**
 * Fastq read index.
 */
export type ReadIndex = 'R1' | 'R2' | 'I1' | 'I2';

/**
 * Fastq files group (read index -> file handle).
 */
export type FastqFileGroup = Partial<Record<ReadIndex, ImportFileHandle>>;

/**
 * Plain fastq dataset content.
 */
export interface DatasetContentFastq {
  type: 'Fastq';
  gzipped: boolean;
  readIndices: ReadIndex[];
  data: Record<PlId, FastqFileGroup>;
}

/**
 * Sequencing lane
 */
export type Lane = string;

/**
 * Multilane fastq dataset content.
 */
export interface DatasetContentMultilaneFastq {
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

/**
 * Fastq dataset content with additional tags.
 */
export interface DatasetContentTaggedFastq {
  type: 'TaggedFastq';
  gzipped: boolean;
  readIndices: ReadIndex[];
  hasLanes: boolean;
  tags: string[];
  data: Record<PlId, TaggedDatasetRecord[]>;
}

/**
 * XSV dataset content.
 */
export interface DatasetContentMultiXsv {
  type: 'MultiXsv';
  tags: string[];
  data: Record<PlId, TaggedDatasetRecord[]>;
}

export type DatasetContent =
  | DatasetContentFastq
  | DatasetContentMultilaneFastq
  | DatasetContentTaggedFastq
  | DatasetContentFasta;

export interface Dataset<ContentType> {
  id: PlId;
  label: string;
  content: ContentType;
}

export type DatasetAny = Dataset<DatasetContent>;
export type DatasetFasta = Dataset<DatasetContentFasta>;
export type DatasetFastq = Dataset<DatasetContentFastq>;
export type DatasetMultilaneFastq = Dataset<DatasetContentMultilaneFastq>;
export type DatasetTaggedFastq = Dataset<DatasetContentTaggedFastq>;

export type DatasetType = DatasetAny['content']['type'];
