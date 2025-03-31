import { ImportFileHandle } from '@platforma-sdk/model';
import { FileNamePatternMatch } from './file_name_parser';

export type ParsedFile = {
  handle: ImportFileHandle;
  fileName: string;
  match?: FileNamePatternMatch;
};
