import { ImportFileHandle, ValueType } from '@platforma-sdk/model';
import { ZodAnyDef, ZodSchema, string, z } from 'zod';
import { PlId } from './helpers';

export const MetadataValueTypeLong = z.literal('Long') satisfies ZodSchema<ValueType>;
export const MetadataValueTypeDouble = z.literal('Double') satisfies ZodSchema<ValueType>;
export const MetadataValueTypeString = z.literal('String') satisfies ZodSchema<ValueType>;

export const MetadataColumnMeta = z
  .object({
    id: z
      .string()
      .min(1)
      .describe(
        'Id of the metadata column, that is assigned when column is created and never changes. ' +
          'Value of this field will also used in resulting PColumn domain, if global option is false. ' +
          'If global is set to true, normalized label will be used.'
      ),
    label: z
      .string()
      .min(1)
      .describe(
        'Human readable name of the metadata column. ' +
          'Value of this field will be used in resulting PColumn domain, if global option is true. ' +
          'String normalization proceduyre will be applied before setting the domain.'
      ),
    global: z
      .boolean()
      .describe('Regulates identifier derivation, see description of the fields above.')
  })
  .strict();

export const MetadataDataDouble = z
  .object({
    valueType: MetadataValueTypeDouble,
    data: z.record(PlId, z.number())
  })
  .strict();

export const MetadataDataLong = z
  .object({
    valueType: MetadataValueTypeLong,
    data: z.record(PlId, z.number().int())
  })
  .strict();

export const MetadataDataString = z
  .object({
    valueType: MetadataValueTypeString,
    data: z.record(PlId, z.string())
  })
  .strict();

export const MetadataColumn = z
  .discriminatedUnion('valueType', [MetadataDataDouble, MetadataDataLong, MetadataDataString])
  .and(MetadataColumnMeta);
export type MetadataColumn = z.infer<typeof MetadataColumn>;
export type MetadataColumnValueType = MetadataColumn['valueType'];

export const ImportFileHandleSchema = z
  .string()
  .refine<ImportFileHandle>(((a) => true) as (arg: string) => arg is ImportFileHandle);

export const ReadIndexSchemas = [
  z.literal('R1'),
  z.literal('R2'),
  z.literal('I1'),
  z.literal('I2')
] as const;
export const ReadIndex = z.union(ReadIndexSchemas);
export type ReadIndex = z.infer<typeof ReadIndex>;

export const AllReadIndices = ReadIndexSchemas.map((s) => s.value);
export const ReadIndices = z.array(ReadIndex);
export type ReadIndices = z.infer<typeof ReadIndices>;

export const FastqFileGroup = z.record(ReadIndex, ImportFileHandleSchema);
export type FastqFileGroup = z.infer<typeof FastqFileGroup>;

export const DatasetContentFasta = z
  .object({
    type: z.literal('Fasta'),
    gzipped: z.boolean(),
    data: z.record(
      PlId,
      ImportFileHandleSchema.nullable() /* null meand sampple is added to the dataset, but file is not yet set */
    )
  })
  .strict();
export type DatasetContentFasta = z.infer<typeof DatasetContentFasta>;

export const DatasetContentFastq = z
  .object({
    type: z.literal('Fastq'),
    gzipped: z.boolean(),
    readIndices: z.array(ReadIndex),
    data: z.record(PlId, FastqFileGroup)
  })
  .strict();
export type DatasetContentFastq = z.infer<typeof DatasetContentFastq>;

export const Lane = z
  .string()
  .regex(/[0-9]+/)
  .describe('Lane');
export type Lane = z.infer<typeof Lane>;

export const DatasetContentMultilaneFastq = z
  .object({
    type: z.literal('MultilaneFastq'),
    gzipped: z.boolean(),
    readIndices: z.array(ReadIndex),
    data: z.record(PlId, z.record(Lane, FastqFileGroup))
  })
  .strict();
export type DatasetContentMultilaneFastq = z.infer<typeof DatasetContentMultilaneFastq>;

export const TaggedDatasetRecord = z.object({
  lane: z.string().optional(),
  tags: z.record(z.string(), z.string()),
  files: FastqFileGroup
});
export type TaggedDatasetRecord = z.infer<typeof TaggedDatasetRecord>;

export const DatasetContentTaggedFastq = z
  .object({
    type: z.literal('TaggedFastq'),
    gzipped: z.boolean(),
    readIndices: z.array(ReadIndex),
    hasLanes: z.boolean(),
    tags: z.string(z.string()),
    data: z.record(PlId, z.array(TaggedDatasetRecord))
  })
  .strict();
export type DatasetContentTaggedFastq = z.infer<typeof DatasetContentTaggedFastq>;

export const DatasetContent = z.discriminatedUnion('type', [
  DatasetContentFastq,
  DatasetContentMultilaneFastq,
  DatasetContentTaggedFastq,
  DatasetContentFasta
]);
export type DatasetContent = z.infer<typeof DatasetContent>;

export function Dataset<const ContentType extends z.ZodTypeAny>(content: ContentType) {
  return z.object({
    id: PlId,
    label: z.string(),
    content
  });
}

export const DatasetAny = Dataset(DatasetContent);
export const DatasetFasta = Dataset(DatasetContentFasta);
export type DatasetFasta = z.infer<typeof DatasetFasta>;
export const DatasetFastq = Dataset(DatasetContentFastq);
export type DatasetFastq = z.infer<typeof DatasetFastq>;
export const DatasetMultilaneFastq = Dataset(DatasetContentMultilaneFastq);
export type DatasetMultilaneFastq = z.infer<typeof DatasetMultilaneFastq>;
export const DatasetTaggedFastq = Dataset(DatasetContentTaggedFastq);
export type DatasetTaggedFastq = z.infer<typeof DatasetTaggedFastq>;

export type DatasetAny = z.infer<typeof DatasetAny>;
export type DatasetType = DatasetAny['content']['type'];

export const BlockArgs = z
  .object({
    blockTitle: z.string().optional(),
    sampleIds: z.array(PlId),
    sampleLabelColumnLabel: z.string(),
    sampleLabels: z.record(PlId, z.string()),
    metadata: z.array(MetadataColumn),
    datasets: z.array(DatasetAny)
  })
  .strict();
export type BlockArgs = z.infer<typeof BlockArgs>;
