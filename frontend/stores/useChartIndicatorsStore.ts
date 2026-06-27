import { create } from "zustand";
import {
  INDICATOR_REGISTRY,
  SMA_KIND,
  TEMP_SMA_INSTANCE_ID,
} from "@/lib/indicators";
import type {
  IndicatorInstance,
  IndicatorParams,
  IndicatorRuntime,
} from "@/lib/indicators";

interface ChartIndicatorsState {
  instances: IndicatorInstance[];
  runtime: Record<string, IndicatorRuntime>;
  addInstance: (
    kind: string,
    params?: Partial<IndicatorParams>,
    id?: string,
  ) => string;
  removeInstance: (id: string) => void;
  setVisible: (id: string, visible: boolean) => void;
  updateParams: (id: string, params: IndicatorParams) => void;
  setRuntime: (id: string, runtime: IndicatorRuntime) => void;
  clearRuntime: () => void;
  toggleTempSma: () => void;
  isTempSmaActive: () => boolean;
}

export const useChartIndicatorsStore = create<ChartIndicatorsState>(
  (set, get) => ({
    instances: [],
    runtime: {},

    addInstance: (kind, paramsOverride, id) => {
      const definition = INDICATOR_REGISTRY[kind];
      if (!definition) {
        throw new Error(`Unknown indicator kind: ${kind}`);
      }

      const instanceId = id ?? `${kind}-${Date.now()}`;
      const params = { ...definition.defaultParams };

      if (paramsOverride) {
        for (const [key, value] of Object.entries(paramsOverride)) {
          if (value !== undefined) {
            params[key] = value;
          }
        }
      }

      const instance: IndicatorInstance = {
        id: instanceId,
        kind,
        params,
        visible: true,
      };

      set((state) => ({
        instances: [
          ...state.instances.filter((item) => item.id !== instanceId),
          instance,
        ],
      }));

      return instanceId;
    },

    removeInstance: (id) => {
      set((state) => {
        const { [id]: _removed, ...runtime } = state.runtime;
        return {
          instances: state.instances.filter((instance) => instance.id !== id),
          runtime,
        };
      });
    },

    setVisible: (id, visible) => {
      set((state) => ({
        instances: state.instances.map((instance) =>
          instance.id === id ? { ...instance, visible } : instance,
        ),
      }));
    },

    updateParams: (id, params) => {
      set((state) => ({
        instances: state.instances.map((instance) =>
          instance.id === id ? { ...instance, params } : instance,
        ),
      }));
    },

    setRuntime: (id, runtime) => {
      set((state) => ({
        runtime: { ...state.runtime, [id]: runtime },
      }));
    },

    clearRuntime: () => {
      set({ runtime: {} });
    },

    toggleTempSma: () => {
      const { instances, addInstance, removeInstance } = get();
      const existing = instances.find(
        (instance) => instance.id === TEMP_SMA_INSTANCE_ID,
      );

      if (existing) {
        removeInstance(TEMP_SMA_INSTANCE_ID);
        return;
      }

      addInstance(SMA_KIND, undefined, TEMP_SMA_INSTANCE_ID);
    },

    isTempSmaActive: () =>
      get().instances.some((instance) => instance.id === TEMP_SMA_INSTANCE_ID),
  }),
);
