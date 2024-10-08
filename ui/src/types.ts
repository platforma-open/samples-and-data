import { ImportFileHandle } from '@platforma-sdk/model';
import { FileNamePatternMatch } from './file_name_parser';
import { InjectionKey, Ref } from 'vue';

export type ParsedFile = {
  handle: ImportFileHandle;
  fileName: string;
  match?: FileNamePatternMatch;
};

// If true, and there are no datasets, will automatically navidgate to import files
export const SuggestedImport = Symbol() as InjectionKey<Ref<boolean>>;
