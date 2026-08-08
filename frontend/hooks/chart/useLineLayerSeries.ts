"use client";

import { useCallback } from "react";
import { LineSeries, type IChartApi } from "lightweight-charts";
import type { Datafeed } from "@/lib/chart";
import type { IndicatorChartLayer } from "@/lib/chart-block";
import {
  paneIndexForLayer,
  type LayerSpec,
  type PaneSpec,
} from "@/lib/chart-block";
import {
  buildLineSeriesOptions,
  filterLineIndicatorLayers,
  isLineIndicatorLayer,
} from "@/lib/indicators";
import { filterIndicatorLayers } from "@/lib/chart-block";
import { useChartLayersStore } from "@/stores/useChartLayersStore";
import { useIndicatorLineSeries } from "./useIndicatorLineSeries";

interface UseLineLayerSeriesParams {
  chartRef: React.RefObject<IChartApi | null>;
  datafeedRef: React.RefObject<Datafeed>;
  chartReady: boolean;
  panes: PaneSpec[];
  layoutKey: string;
  chartInstanceId: number;
}

export function useLineLayerSeries({
  chartRef,
  datafeedRef,
  chartReady,
  panes,
  layoutKey,
  chartInstanceId,
}: UseLineLayerSeriesParams): void {
  const allLayers = useChartLayersStore((state) => state.layers);
  const indicatorLayers = filterIndicatorLayers(allLayers);
  const lineLayers = filterLineIndicatorLayers(indicatorLayers);

  const resolveLayer = useCallback(
    (layer: IndicatorChartLayer): LayerSpec | null => {
      for (const pane of panes) {
        const specLayer = pane.layers.find((item) => item.id === layer.id);
        if (specLayer) {
          return specLayer;
        }
      }
      return null;
    },
    [panes],
  );

  const addSeries = useCallback(
    (
      chart: IChartApi,
      layer: IndicatorChartLayer,
      definition: Parameters<typeof buildLineSeriesOptions>[1],
    ) => {
      const paneIndex = paneIndexForLayer(panes, layer.id);
      const options = buildLineSeriesOptions(layer, definition);
      return paneIndex <= 0
        ? chart.addSeries(LineSeries, options)
        : chart.addSeries(LineSeries, options, paneIndex);
    },
    [panes],
  );

  useIndicatorLineSeries({
    chartRef,
    datafeedRef,
    chartReady,
    indicatorLayers: lineLayers,
    allIndicatorLayers: indicatorLayers,
    isPlacementMatch: isLineIndicatorLayer,
    resolveLayer,
    addSeries,
    layoutKey,
    chartInstanceId,
  });
}
