import type { BlockData } from '@platforma-open/milaboratories.samples-and-data.model';
import type { LocalBlobHandleAndSize, PlId, RemoteBlobHandleAndSize } from '@platforma-sdk/model';
import type { PlAgHeaderComponentParams } from '@platforma-sdk/ui-vue';
import { PlAgColumnHeader, type ReactiveFileContent } from '@platforma-sdk/ui-vue';
import type { ColDef, GridApi, IRowNode } from 'ag-grid-enterprise';

export function setEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  const bSet = new Set(b);
  if (aSet.size !== bSet.size) return false;
  for (const v of aSet) {
    if (!bSet.has(v)) return false;
  }
  return true;
}

export function agSampleIdComparator(labels: Record<string, string>) {
  return (a: string, b: string) => {
    const aLabel = labels[a] ?? a;
    const bLabel = labels[b] ?? b;
    if (aLabel == bLabel) return 0;
    return (aLabel > bLabel) ? 1 : -1;
  };
}

export function getSelectedSamples<RowT extends { readonly sample: PlId }>(
  api: GridApi<RowT>,
  node: IRowNode<RowT> | null,
): PlId[] {
  const samples = api
    .getSelectedRows()
    .map((row) => row.sample);
  if (samples.length !== 0)
    return samples;
  const sample = node?.data?.sample;
  if (!sample)
    return [];
  return [sample];
}

export function getSelectedSamplesAndTags<RowT extends { readonly sample: PlId; readonly tags: Record<string, string> }>(
  api: GridApi<RowT>,
  node: IRowNode<RowT> | null,
): { sampleId: PlId; tags: Record<string, string> }[] {
  const samples = api
    .getSelectedRows()
    .map((row) => ({ sampleId: row.sample, tags: row.tags }));
  if (samples.length !== 0)
    return samples;
  const sampleId = node?.data?.sample;
  if (!sampleId)
    return [];
  return [{ sampleId, tags: node?.data?.tags ?? {} }];
}

export function agGroupIdColumnDef<RowT extends { readonly groupId: PlId; readonly groupLabel: string }>(): ColDef<RowT> {
  return {
    headerName: 'File group',
    flex: 1,
    valueGetter: (params) => params.data?.groupLabel,
    editable: false,
    pinned: 'left',
    lockPinned: true,
    headerComponent: PlAgColumnHeader,
    headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
  };
}

export function agSampleIdColumnDef<RowT extends { readonly sample: PlId }>(appUt: unknown): ColDef<RowT> {
  const app = appUt as { model: { data: BlockData } };

  const sampleLabels = app.model.data.sampleLabels as Record<string, string>;

  const sampleIdComparator = agSampleIdComparator(sampleLabels);

  return {
    headerName: app.model.data.sampleLabelColumnLabel,
    flex: 1,
    valueGetter: (params) => params.data?.sample,
    editable: false,
    refData: sampleLabels,
    pinned: 'left',
    lockPinned: true,
    comparator: sampleIdComparator,
    headerComponent: PlAgColumnHeader,
    headerComponentParams: { type: 'Text' } satisfies PlAgHeaderComponentParams,
  };
}

/**
 * Parse CSV content from a blob handle.
 * Returns an array of trimmed non-empty lines.
 */
export function parseCsvFromHandle(
  reactiveFileContent: ReactiveFileContent,
  fileHandleAndSize: LocalBlobHandleAndSize | RemoteBlobHandleAndSize | undefined,
): string[] | undefined {
  if (!fileHandleAndSize) return undefined;

  const csvContent = reactiveFileContent.getContentString(fileHandleAndSize.handle)?.value;
  if (!csvContent) return undefined;

  return csvContent
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0);
}

/**
 * Parse a map of file handles to CSV content.
 * Used for availableColumns: Record<ImportFileHandle, LocalBlobHandleAndSize> -> Record<string, string[]>
 */
export function parseCsvMapFromHandles<K extends string = string>(
  reactiveFileContent: ReactiveFileContent,
  fileHandlesMap: Record<K, LocalBlobHandleAndSize | RemoteBlobHandleAndSize | undefined> | undefined,
): Record<K, string[]> | undefined {
  if (!fileHandlesMap) return undefined;

  const result: Record<string, string[]> = {};
  for (const [key, fileHandleAndSize] of Object.entries(fileHandlesMap)) {
    if (fileHandleAndSize && typeof fileHandleAndSize === 'object' && 'handle' in fileHandleAndSize && 'size' in fileHandleAndSize) {
      const parsed = parseCsvFromHandle(
        reactiveFileContent,
        fileHandleAndSize as LocalBlobHandleAndSize | RemoteBlobHandleAndSize,
      );
      if (parsed) {
        result[key] = parsed;
      }
    }
  }
  return result as Record<K, string[]>;
}

/**
 * Parse nested map of file handles (e.g., sampleGroups).
 * Used for: Record<DatasetId, Record<GroupId, LocalBlobHandleAndSize>> -> Record<DatasetId, Record<GroupId, PlId[]>>
 */
export function parseCsvNestedMapFromHandles<
  OuterK extends string = string,
  InnerK extends string = string,
  ValueT extends string = string,
>(
  reactiveFileContent: ReactiveFileContent,
  nestedMap: Record<OuterK, Record<InnerK, LocalBlobHandleAndSize | RemoteBlobHandleAndSize | undefined>> | undefined,
): Record<OuterK, Record<InnerK, ValueT[]>> | undefined {
  if (!nestedMap) return undefined;

  const result: Record<string, Record<string, ValueT[]>> = {};
  for (const [outerKey, innerMap] of Object.entries(nestedMap)) {
    if (innerMap && typeof innerMap === 'object') {
      result[outerKey] = {};
      for (const [innerKey, fileHandleAndSize] of Object.entries(innerMap)) {
        if (fileHandleAndSize && typeof fileHandleAndSize === 'object' && 'handle' in fileHandleAndSize && 'size' in fileHandleAndSize) {
          const parsed = parseCsvFromHandle(
            reactiveFileContent,
            fileHandleAndSize as LocalBlobHandleAndSize | RemoteBlobHandleAndSize,
          );
          if (parsed) {
            result[outerKey][innerKey] = parsed as ValueT[];
          }
        }
      }
    }
  }
  return result as Record<OuterK, Record<InnerK, ValueT[]>>;
}
