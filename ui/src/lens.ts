import { BlockArgs } from '@platforma-open/milaboratories.samples-and-data.model';
import { useApp } from './app';
import { DeepReadonly, Ref, ref, watch } from 'vue';

// type ExtractFieldType<T, Path extends any[]> = Path extends [infer Key, ...infer Rest]
//   ? Key extends keyof T
//     ? ExtractFieldType<T[Key], Rest>
//     : never
//   : T;

// export type Lens<T> = {
//   value: Ref<T>;
//   connected: Ref<boolean>;
// };

// type ExtractionResult<T, Path extends string[]> =
//   | { connected: false; value?: undefined }
//   | { connected: true; value: ExtractFieldType<T, Path> };

// function extractValue<T, const Path extends string[]>(
//   obj: T,
//   path: Path
// ): ExtractionResult<T, Path> {
//   let c: any = obj;
//   for (const key in path) {
//     if (c === undefined) {
//       return { connected: false };
//     }
//     c = c[key];
//   }
//   return { connected: true, value: c as ExtractFieldType<T, Path> };
// }

// function setValue<T, const Path extends string[]>(
//   obj: T,
//   path: Path,
//   v: ExtractFieldType<T, Path>
// ) {
//   let c: any = obj;
//   for (let i = 0; i < path.length - 1; ++i) {
//     const key = path[i];
//     if (c === undefined) throw new Error(`No such field step = ${i}, path = [${path.join(', ')}]`);
//     c = c[key];
//   }
//   c[path[path.length - 1]] = v;
// }

// export function reactiveLens<T, const Path extends string[]>(
//   source: MaybeRef<T>,
//   ...path: Path
// ): Lens<ExtractFieldType<T, Path>> {
//   const initialValue = extractValue(unref(source), path);
//   if (initialValue.connected === false)
//     throw new Error(`Can't get field, path = [${path.join(', ')}]`);
//   const value = ref<ExtractFieldType<T, Path>>(initialValue.value) as Ref<
//     ExtractFieldType<T, Path>
//   >;
//   const connected = ref<boolean>(true);

//   const { stop, ignoreUpdates } = watchIgnorable(
//     value,
//     (v) => {
//       setValue(unref(source), path, deepClone(v));
//     },
//     {
//       immediate: true,
//       deep: true
//     }
//   );

//   watch(
//     () => extractValue(unref(source), path),
//     (extractionResult) => {
//       if (!extractionResult.connected) connected.value = false;
//       else
//         ignoreUpdates(() => {
//           value.value = extractionResult.value;
//         });
//     }
//   );

//   return { value, connected };
// }

export type ArgsModel<T> = {
  value: DeepReadonly<T>;
  connected: Ref<boolean>;
  update: (op: (value: T) => void) => void;
};

export type ArgsModelOps<T> = {
  get: (args: BlockArgs) => T | undefined;
  onDisconnected?: () => void;
};

export function argsModel<T>(app: ReturnType<typeof useApp>, ops: ArgsModelOps<T>): ArgsModel<T> {
  const connected = ref(true);
  const initialValue = ops.get(app.model.args);
  if (initialValue === undefined) {
    connected.value = false;
    if (ops.onDisconnected) ops.onDisconnected();
    return {
      connected,
      value: undefined as DeepReadonly<T>,
      update: () => {} // noop we are disconnected
    };
  }
  const r = ref<T>(initialValue) as Ref<T>;
  watch(
    () => app.model.args,
    (args) => {
      if (!connected.value) return;
      const newValue = ops.get(args);
      console.dir(newValue, { depth: 5 });
      if (newValue === undefined) {
        if (ops.onDisconnected) ops.onDisconnected();
        connected.value = false;
        return;
      }
      r.value = newValue;
    }
  );
  return {
    connected,
    get value() {
      return r.value as DeepReadonly<T>;
    },
    update: (op) => {
      if (!connected.value) throw new Error("Can't mutate disconnected model");
      app.updateArgs((args) => {
        const value = ops.get(args);
        if (value === undefined) {
          connected.value = false;
          if (ops.onDisconnected) ops.onDisconnected();
          throw new Error("Can't mutate disconnected model");
        }
        op(value);
        // shortcut setting updated value
        r.value = value;
      });
    }
  };
}
