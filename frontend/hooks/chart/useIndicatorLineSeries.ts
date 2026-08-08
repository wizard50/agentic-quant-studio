"use client";

import { useCallback, useEffect, useRef } from "react";
import { type IChartApi, type ISeriesApi } from "lightweight-charts";
import {
  extractValuedLinePoints,
  lineDataHasValues,
} from "@/lib/chart/mapSeries";
import type { IndicatorChartLayer } from "@/lib/chart-block";
import type { Datafeed } from "@/lib/chart";
import { parseLineLayerData, type LayerSpec } from "@/lib/chart-block";
import {
  buildLineSeriesOptions,
  lookupIndicatorDefinition,
} from "@/lib/indicators";
import type { IndicatorDefinition } from "@/lib/indicators";
import { useChartLayersStore } from "@/stores/useChartLayersStore";

export interface UseIndicatorLineSeriesParams {
  chartRef: React.RefObject<IChartApi | null>;
  datafeedRef: React.RefObject<Datafeed>;
  chartReady: boolean;
  indicatorLayers: IndicatorChartLayer[];
  allIndicatorLayers: IndicatorChartLayer[];
  isPlacementMatch: (layer: IndicatorChartLayer) => boolean;
  resolveLayer: (layer: IndicatorChartLayer) => LayerSpec | null;
  addSeries: (
    chart: IChartApi,
    layer: IndicatorChartLayer,
    definition: IndicatorDefinition,
  ) => ISeriesApi<"Line">;
  layoutKey: string;
  chartInstanceId: number;
}

function responseHasLineOutput(
  response: NonNullable<ReturnType<Datafeed["getLastResponse"]>>,
  layer: IndicatorChartLayer,
): boolean {
  const outputKey = `${layer.id}.value`;
  const output = response.outputs[outputKey];
  return output?.kind === "series_f64" && Array.isArray(output.values);
}

export function useIndicatorLineSeries({
  chartRef,
  datafeedRef,
  chartReady,
  indicatorLayers,
  allIndicatorLayers,
  isPlacementMatch,
  resolveLayer,
  addSeries,
  layoutKey,
  chartInstanceId,
}: UseIndicatorLineSeriesParams): void {
  const setLayerStatus = useChartLayersStore((state) => state.setLayerStatus);
  const clearLayerStatus = useChartLayersStore(
    (state) => state.clearLayerStatus,
  );
  const chartLayers = useChartLayersStore((state) => state.layers);

  const seriesByIdRef = useRef(new Map<string, ISeriesApi<"Line">>());
  const appliedGenerationRef = useRef(0);

  const reportLayerStatus = useCallback(
    (layerId: string, loading: boolean, error: string | null) => {
      setLayerStatus(layerId, { loading, error });
    },
    [setLayerStatus],
  );

  const removeSeries = useCallback(
    (layerId: string) => {
      const chart = chartRef.current;
      const series = seriesByIdRef.current.get(layerId);

      if (chart && series) {
        try {
          chart.removeSeries(series);
        } catch {
          // Chart was recreated or disposed.
        }
      }

      seriesByIdRef.current.delete(layerId);
    },
    [chartRef],
  );

  const ensureSeries = useCallback(
    (layer: IndicatorChartLayer): ISeriesApi<"Line"> | null => {
      const chart = chartRef.current;
      const definition = lookupIndicatorDefinition(layer.indicatorKind);

      if (!chart || !definition || !isPlacementMatch(layer)) {
        return null;
      }

      let series = seriesByIdRef.current.get(layer.id);
      if (!series) {
        series = addSeries(chart, layer, definition);
        series.applyOptions(buildLineSeriesOptions(layer, definition, false));
        seriesByIdRef.current.set(layer.id, series);
      }

      return series;
    },
    [addSeries, chartRef, isPlacementMatch],
  );

  const syncSeriesVisibility = useCallback((layer: IndicatorChartLayer) => {
    const definition = lookupIndicatorDefinition(layer.indicatorKind);
    const series = seriesByIdRef.current.get(layer.id);
    if (!definition || !series) {
      return;
    }

    series.applyOptions(
      buildLineSeriesOptions(layer, definition, layer.visible),
    );
  }, []);

  const applyFromViewport = useCallback(() => {
    const feed = datafeedRef.current;
    const response = feed.getLastResponse();
    const candles = feed.getCandles();

    if (!response || !chartReady) {
      return;
    }

    const generation = ++appliedGenerationRef.current;
    const visibleLayers = indicatorLayers.filter((layer) => layer.visible);

    for (const layer of visibleLayers) {
      reportLayerStatus(layer.id, false, null);
    }

    for (const layer of visibleLayers) {
      const definition = lookupIndicatorDefinition(layer.indicatorKind);
      const specLayer = resolveLayer(layer);

      if (!definition || !specLayer) {
        continue;
      }

      if (!responseHasLineOutput(response, layer)) {
        removeSeries(layer.id);
        continue;
      }

      try {
        const lineData = parseLineLayerData(
          response,
          specLayer,
          candles,
          layer,
        );

        if (generation !== appliedGenerationRef.current) {
          return;
        }

        if (!lineData || !lineDataHasValues(lineData)) {
          removeSeries(layer.id);
          continue;
        }

        const series = ensureSeries(layer);
        if (!series) {
          continue;
        }

        series.setData(extractValuedLinePoints(lineData));
        series.applyOptions(
          buildLineSeriesOptions(layer, definition, layer.visible),
        );
      } catch (cause) {
        if (generation !== appliedGenerationRef.current) {
          return;
        }

        removeSeries(layer.id);

        const message =
          cause instanceof Error ? cause.message : "Failed to load indicator";
        reportLayerStatus(layer.id, false, message);
      }
    }
  }, [
    chartReady,
    ensureSeries,
    indicatorLayers,
    removeSeries,
    resolveLayer,
    reportLayerStatus,
    datafeedRef,
  ]);

  // Chart recreation invalidates series handles — do not removeSeries on the new chart.
  useEffect(() => {
    seriesByIdRef.current.clear();
    appliedGenerationRef.current += 1;
  }, [layoutKey, chartInstanceId]);

  useEffect(() => {
    if (!chartReady) {
      // Prefer clear over removeSeries: chart may already be torn down.
      if (!chartRef.current) {
        seriesByIdRef.current.clear();
        return;
      }
      for (const layerId of [...seriesByIdRef.current.keys()]) {
        removeSeries(layerId);
      }
      return;
    }

    const currentIds = new Set(allIndicatorLayers.map((layer) => layer.id));

    for (const layerId of seriesByIdRef.current.keys()) {
      if (!currentIds.has(layerId)) {
        removeSeries(layerId);
      }
    }

    for (const layerId of seriesByIdRef.current.keys()) {
      const layer = allIndicatorLayers.find((item) => item.id === layerId);
      if (layer && !isPlacementMatch(layer)) {
        removeSeries(layerId);
      }
    }

    for (const layer of indicatorLayers) {
      syncSeriesVisibility(layer);
    }

    applyFromViewport();
  }, [
    allIndicatorLayers,
    applyFromViewport,
    chartReady,
    chartRef,
    indicatorLayers,
    isPlacementMatch,
    layoutKey,
    removeSeries,
    syncSeriesVisibility,
    chartLayers,
  ]);

  useEffect(() => {
    return datafeedRef.current.subscribe((event) => {
      if (event.type === "reset") {
        appliedGenerationRef.current += 1;

        for (const layerId of [...seriesByIdRef.current.keys()]) {
          removeSeries(layerId);
        }

        clearLayerStatus();
        return;
      }

      if (event.type === "loading") {
        for (const layer of indicatorLayers.filter((item) => item.visible)) {
          reportLayerStatus(layer.id, true, null);
        }
        return;
      }

      if (event.type === "replace" || event.type === "prepend") {
        applyFromViewport();
      }
    });
  }, [
    applyFromViewport,
    clearLayerStatus,
    datafeedRef,
    indicatorLayers,
    removeSeries,
    reportLayerStatus,
  ]);

  useEffect(() => {
    const seriesById = seriesByIdRef.current;

    return () => {
      appliedGenerationRef.current += 1;
      seriesById.clear();
    };
  }, []);
}
