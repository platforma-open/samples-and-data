
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
  }
}