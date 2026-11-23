import { useApp } from "../app";
import { useUploadedTableImport } from "./useUploadedTableImport";

export function useMetadataImport() {
  const app = useApp();
  return useUploadedTableImport({
    getHandle: () => app.model.data.metadataUploadHandle,
    setHandle: (handle) => {
      app.model.data.metadataUploadHandle = handle;
    },
    getFile: () => app.model.outputs.metadataFile,
  });
}
