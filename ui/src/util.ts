type Entries<T> = {
  [K in keyof T]: [K, Required<T[K]>];
}[keyof T][];

export function typeSafeEntries<T>(obj: T): Entries<T> {
  return Object.entries(obj as any) as Entries<T>;
}

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
