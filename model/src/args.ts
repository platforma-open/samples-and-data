import { ImportFileHandle, ValueType } from '@milaboratory/sdk-ui';
import { ZodSchema, z } from 'zod';
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

export const ReadIndices = ReadIndexSchemas.map((s) => s.value);

export const FastqFileGroup = z.record(ReadIndex, ImportFileHandleSchema);

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

export const DatasetContentMultilaneFastq = z
  .object({
    type: z.literal('MultilaneFastq'),
    gzipped: z.boolean(),
    readIndices: z.array(ReadIndex),
    data: z.record(PlId, z.record(Lane, FastqFileGroup))
  })
  .strict();
export type DatasetContentMultilaneFastq = z.infer<typeof DatasetContentMultilaneFastq>;

export const DatasetContent = z.discriminatedUnion('type', [
  DatasetContentFastq,
  DatasetContentMultilaneFastq
]);
export type DatasetContent = z.infer<typeof DatasetContent>;

export const Dataset = z.object({
  id: PlId,
  label: z.string(),
  content: DatasetContent
});
export type Dataset = z.infer<typeof Dataset>;

export const BlockArgs = z
  .object({
    sampleIds: z.array(PlId),
    sampleLabelColumnLabel: z.string(),
    sampleLabels: z.record(PlId, z.string()),
    metadata: z.array(MetadataColumn),
    datasets: z.array(Dataset)
  })
  .strict();
export type BlockArgs = z.infer<typeof BlockArgs>;
