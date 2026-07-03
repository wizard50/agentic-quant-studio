import { create } from "zustand";
import {
  createDefaultMarketLayer,
  filterIndicatorLayers,
  isMarketChartLayer,
  type ChartLayer,
  type ChartLayerStatus,
  type IndicatorChartLayer,
} from "@/lib/chart-block";
import {
  createInstanceId,
  createVolumeBuiltinLayer,
  lookupIndicatorDefinition,
  pickIndicatorColor,
} from "@/lib/indicators";
import type { IndicatorParams } from "@/lib/indicators";

interface ChartLayersState {
  layers: ChartLayer[];
  layerStatusById: Record<string, ChartLayerStatus>;
  addIndicator: (
    kind: string,
    params?: Partial<IndicatorParams>,
    id?: string,
  ) => string;
  removeLayer: (id: string) => void;
  setVisible: (id: string, visible: boolean) => void;
  updateIndicatorParams: (id: string, params: IndicatorParams) => void;
  setLayerStatus: (id: string, status: ChartLayerStatus) => void;
  clearLayerStatus: () => void;
}

function withLayerVisible(
  layers: ChartLayer[],
  id: string,
  visible: boolean,
): ChartLayer[] {
  return layers.map((layer) =>
    layer.id === id ? { ...layer, visible } : layer,
  );
}

function withIndicatorParams(
  layers: ChartLayer[],
  id: string,
  params: IndicatorParams,
): ChartLayer[] {
  return layers.map((layer) =>
    layer.id === id && layer.kind === "indicator"
      ? { ...layer, params }
      : layer,
  );
}

export const useChartLayersStore = create<ChartLayersState>((set, get) => ({
  layers: [createDefaultMarketLayer(), createVolumeBuiltinLayer()],
  layerStatusById: {},

  addIndicator: (kind, paramsOverride, id) => {
    const definition = lookupIndicatorDefinition(kind);
    if (!definition) {
      throw new Error(`Unknown indicator kind: ${kind}`);
    }

    const layerId = id ?? createInstanceId(kind);
    const params = { ...definition.defaultParams };

    if (paramsOverride) {
      for (const [key, value] of Object.entries(paramsOverride)) {
        if (value !== undefined) {
          params[key] = value;
        }
      }
    }

    set((state) => {
      const existingIndicators = filterIndicatorLayers(state.layers);
      const layer: IndicatorChartLayer = {
        id: layerId,
        kind: "indicator",
        indicatorKind: kind,
        params,
        visible: true,
        color: pickIndicatorColor(existingIndicators),
      };

      const withoutDuplicate = state.layers.filter(
        (item) => item.id !== layerId,
      );

      return {
        layers: [...withoutDuplicate, layer],
      };
    });

    return layerId;
  },

  removeLayer: (id) => {
    const layer = get().layers.find((item) => item.id === id);
    if (layer && isMarketChartLayer(layer)) {
      return;
    }

    set((state) => {
      const { [id]: _removed, ...layerStatusById } = state.layerStatusById;
      return {
        layers: state.layers.filter((item) => item.id !== id),
        layerStatusById,
      };
    });
  },

  setVisible: (id, visible) => {
    set((state) => ({
      layers: withLayerVisible(state.layers, id, visible),
    }));
  },

  updateIndicatorParams: (id, params) => {
    set((state) => ({
      layers: withIndicatorParams(state.layers, id, params),
    }));
  },

  setLayerStatus: (id, status) => {
    set((state) => ({
      layerStatusById: { ...state.layerStatusById, [id]: status },
    }));
  },

  clearLayerStatus: () => {
    set({ layerStatusById: {} });
  },
}));
