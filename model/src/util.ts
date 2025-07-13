import type { ReadIndex } from './types';

const VALID_READ_INDICES: ReadonlySet<string> = new Set(['R1', 'R2', 'I1', 'I2']);

export function validateReadIndices(readIndices: string[]): ReadIndex[] {
  for (const readIndex of readIndices) {
    if (!VALID_READ_INDICES.has(readIndex)) {
      throw new Error(`Invalid read index: ${readIndex}`);
    }
  }
  return readIndices as ReadIndex[];
}
