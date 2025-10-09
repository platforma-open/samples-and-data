import type { BlockArgs, DSContentTaggedFastq } from '@platforma-open/milaboratories.samples-and-data.model';
import type { PlId } from '@platforma-sdk/model';
import type { AppV2 } from '@platforma-sdk/ui-vue';
import type { ColDef, GridApi, IRowNode } from 'ag-grid-enterprise';
import { isEqual } from 'radashi';

type Entries<T> = {
  [K in keyof T]: [K, Required<T[K]>];
}[keyof T][];

export function typeSafeEntries<T>(obj: T): Entries<T> {
  return Object.entries(obj as any) as Entries<T>;
}

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

export function agSampleIdColumnDef<RowT extends { readonly sample: PlId }>(appUt: unknown): ColDef<RowT> {
  const app = appUt as AppV2<BlockArgs>;

  const sampleLabels = app.model.args.sampleLabels as Record<string, string>;

  const sampleIdComparator = agSampleIdComparator(sampleLabels);

  return {
    headerName: app.model.args.sampleLabelColumnLabel,
    flex: 1,
    valueGetter: (params) => params.data?.sample,
    editable: false,
    refData: sampleLabels,
    pinned: 'left',
    lockPinned: true,
    comparator: sampleIdComparator,
  };
}
