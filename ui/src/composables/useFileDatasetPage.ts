import type {
  ColDef,
  GridOptions,
} from 'ag-grid-enterprise';
import {
  ClientSideRowModelModule,
  MenuModule,
  ModuleRegistry,
  RichSelectModule,
} from 'ag-grid-enterprise';

import type { PlId } from '@platforma-open/milaboratories.samples-and-data.model';
import type { ImportFileHandle } from '@platforma-sdk/model';
import type { PlAgHeaderComponentParams } from '@platforma-sdk/ui-vue';
import { makeRowNumberColDef, PlAgCellFile, PlAgColumnHeader } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';
import { agSampleIdColumnDef, getSelectedSamples } from '../util';

ModuleRegistry.registerModules([ClientSideRowModelModule, RichSelectModule, MenuModule]);

type DatasetWithFileData = {
  id: PlId;
  content: {
    data: Record<PlId, ImportFileHandle | null>;
  };
};

type FileDatasetRow = {
  readonly sample: PlId;
  readonly data: ImportFileHandle | null;
};

type ValueSetParams = {
  sample: PlId;
  oldValue: ImportFileHandle | null;
  newValue: ImportFileHandle | null;
  dataset: DatasetWithFileData;
  app: ReturnType<typeof useApp>;
};

type DeleteParams = {
  sample: PlId;
  fileHandle: ImportFileHandle | null;
  dataset: DatasetWithFileData;
  app: ReturnType<typeof useApp>;
};

type FileDatasetPageConfig = {
  headerName: string;
  extensions: string[];
  onValueSet?: (params: ValueSetParams) => void;
  onDelete?: (params: DeleteParams) => void;
};

export function useFileDatasetPage<D extends DatasetWithFileData>(
  config: FileDatasetPageConfig,
) {
  const app = useApp();
  const datasetId = app.queryParams.id;

  const dataset = (() => {
    const ds = app.model.data.datasets.find((ds) => ds.id === datasetId);
    if (!ds)
      throw new Error('Dataset not found');
    return ds as D;
  })();

  const rowData = computed(() => Object.entries(dataset.content.data).map(
    ([sampleId, data]) => ({
      sample: sampleId as PlId,
      data,
    }),
  ));

  const defaultColDef: ColDef = {
    suppressHeaderMenuButton: true,
  };

  const columnDefs = computed(() => {
    const res: ColDef<FileDatasetRow>[] = [
      makeRowNumberColDef(),
      agSampleIdColumnDef(app),
    ];

    res.push({
      headerName: config.headerName,
      flex: 2,
      cellStyle: { padding: 0 },

      headerComponent: PlAgColumnHeader,
      headerComponentParams: { type: 'File' } satisfies PlAgHeaderComponentParams,

      cellRendererParams: {
        resolveProgress: (fileHandle: ImportFileHandle | undefined) => {
          if (!fileHandle)
            return undefined;
          else
            return app.progresses[fileHandle];
        },
      },

      cellRendererSelector: (params) =>
        params.data?.sample
          ? {
              component: 'PlAgCellFile',
              params: {
                extensions: config.extensions,
              },
            }
          : undefined,
      valueGetter: (params) => params.data?.sample ? dataset.content.data[params.data.sample] : undefined,
      valueSetter: (params) => {
        const sample = params.data.sample;
        const oldValue = dataset.content.data[sample];
        const newValue = params.newValue ?? null;

        dataset.content.data[sample] = newValue;

        if (config.onValueSet) {
          config.onValueSet({
            sample,
            oldValue,
            newValue,
            dataset,
            app,
          });
        }

        return true;
      },
    } as ColDef<FileDatasetRow, ImportFileHandle>);

    return res;
  });

  const gridOptions: GridOptions<FileDatasetRow> = {
    getRowId: (row) => row.data.sample,
    rowSelection: {
      mode: 'multiRow',
      checkboxes: false,
      headerCheckbox: false,
    },
    rowHeight: 45,
    getMainMenuItems: (_) => {
      return [];
    },
    getContextMenuItems: (params) => {
      if (getSelectedSamples(params.api, params.node).length === 0) return [];
      return [
        {
          name: 'Delete',
          action: (params) => {
            const samplesToDelete = getSelectedSamples(params.api, params.node);
            for (const s of samplesToDelete) {
              const fileHandle = dataset.content.data[s];
              delete dataset.content.data[s];

              if (config.onDelete) {
                config.onDelete({
                  sample: s,
                  fileHandle: fileHandle ?? null,
                  dataset,
                  app,
                });
              }
            }
          },
        },
      ];
    },
    components: {
      PlAgCellFile,
    },
  };

  return {
    dataset,
    rowData,
    defaultColDef,
    columnDefs,
    gridOptions,
  };
}
