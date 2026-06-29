"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import {
  alignLineSeriesToCandles,
  type LineSeriesPoint,
} from "@/lib/chart/mapSeries";
import { PAGE_SIZE } from "@/lib/chart";
import type { CandleDatafeed } from "@/lib/chart/datafeed";
import type { SeriesKey } from "@/lib/chart";
import {
  buildIndicatorDataRange,
  buildIndicatorRunRequest,
  buildLineSeriesOptions,
  filterOverlayInstances,
  INDICATOR_REGISTRY,
  isOverlayInstance,
} from "@/lib/indicators";
import type { IndicatorInstance } from "@/lib/indicators";
import { runStudioGraph } from "@/lib/studio/api";
import { useChartIndicatorsStore } from "@/stores/useChartIndicatorsStore";

interface UseChartIndicatorsParams {
  chartRef: React.RefObject<IChartApi | null>;
  datafeedRef: React.RefObject<CandleDatafeed>;
  marketKey: SeriesKey;
  chartReady: boolean;
}

function buildCacheKey(
  marketKey: SeriesKey,
  instance: IndicatorInstance,
): string {
  return [
    marketKey.exchange,
    marketKey.category,
    marketKey.symbol,
    marketKey.interval,
    instance.id,
    JSON.stringify(instance.params),
  ].join(":");
}

export function useChartIndicators({
  chartRef,
  datafeedRef,
  marketKey,
  chartReady,
}: UseChartIndicatorsParams): void {
  const allInstances = useChartIndicatorsStore((state) => state.instances);
  const instances = filterOverlayInstances(allInstances);
  const setRuntime = useChartIndicatorsStore((state) => state.setRuntime);
  const clearRuntime = useChartIndicatorsStore((state) => state.clearRuntime);

  const seriesByIdRef = useRef(new Map<string, ISeriesApi<"Line">>());
  const dataCacheRef = useRef(new Map<string, LineSeriesPoint[]>());
  const fetchGenerationRef = useRef(0);

  const setInstanceRuntime = useCallback(
    (instanceId: string, loading: boolean, error: string | null) => {
      setRuntime(instanceId, { loading, error });
    },
    [setRuntime],
  );

  const removeSeries = useCallback(
    (instanceId: string) => {
      const chart = chartRef.current;
      const series = seriesByIdRef.current.get(instanceId);

      if (chart && series) {
        chart.removeSeries(series);
      }

      seriesByIdRef.current.delete(instanceId);
    },
    [chartRef],
  );

  const ensureSeries = useCallback(
    (instance: IndicatorInstance): ISeriesApi<"Line"> | null => {
      const chart = chartRef.current;
      if (!chart) {
        return null;
      }

      const definition = INDICATOR_REGISTRY[instance.kind];
      if (!definition || !isOverlayInstance(instance)) {
        return null;
      }

      let series = seriesByIdRef.current.get(instance.id);
      if (!series) {
        series = chart.addSeries(
          LineSeries,
          buildLineSeriesOptions(instance, definition),
        );
        seriesByIdRef.current.set(instance.id, series);
      }

      return series;
    },
    [chartRef],
  );

  const syncSeriesVisibility = useCallback(
    (instance: IndicatorInstance) => {
      const definition = INDICATOR_REGISTRY[instance.kind];
      if (!definition) {
        return;
      }

      const series = instance.visible
        ? ensureSeries(instance)
        : seriesByIdRef.current.get(instance.id);

      if (!series) {
        return;
      }

      series.applyOptions(buildLineSeriesOptions(instance, definition));
    },
    [ensureSeries],
  );

  const applyCachedData = useCallback(
    (instance: IndicatorInstance, currentMarketKey: SeriesKey) => {
      const definition = INDICATOR_REGISTRY[instance.kind];
      if (!definition) {
        return;
      }

      const cacheKey = buildCacheKey(currentMarketKey, instance);
      const cachedData = dataCacheRef.current.get(cacheKey);
      const series = ensureSeries(instance);

      if (!series || !cachedData) {
        return;
      }

      series.setData(cachedData);
      series.applyOptions(buildLineSeriesOptions(instance, definition));
    },
    [ensureSeries],
  );

  const clearCacheForInstance = useCallback((instanceId: string) => {
    for (const cacheKey of dataCacheRef.current.keys()) {
      if (cacheKey.includes(`:${instanceId}:`)) {
        dataCacheRef.current.delete(cacheKey);
      }
    }
  }, []);

  const fetchAndApply = useCallback(
    async (
      currentInstances: IndicatorInstance[],
      currentMarketKey: SeriesKey,
    ) => {
      const chart = chartRef.current;
      const datafeed = datafeedRef.current;
      const overlayInstances = filterOverlayInstances(currentInstances);
      const visibleInstances = overlayInstances.filter(
        (instance) => instance.visible,
      );

      if (!chart || !chartReady || visibleInstances.length === 0) {
        return;
      }

      const dataRange = buildIndicatorDataRange(datafeed, visibleInstances);
      const request = buildIndicatorRunRequest({
        settings: currentMarketKey,
        instances: overlayInstances,
        limit: dataRange?.limit ?? PAGE_SIZE,
        startMs: dataRange?.startMs,
        endMs: dataRange?.endMs,
      });

      if (!request) {
        return;
      }

      const generation = ++fetchGenerationRef.current;

      for (const instance of visibleInstances) {
        setInstanceRuntime(instance.id, true, null);
      }

      try {
        const response = await runStudioGraph(request);

        if (generation !== fetchGenerationRef.current) {
          return;
        }

        for (const instance of visibleInstances) {
          const definition = INDICATOR_REGISTRY[instance.kind];
          if (!definition) {
            continue;
          }

          const parsed = definition.parseLineData(response, instance.id, "ds1");
          const lineData = alignLineSeriesToCandles(
            datafeed.getCandles(),
            parsed,
          );
          const cacheKey = buildCacheKey(currentMarketKey, instance);
          dataCacheRef.current.set(cacheKey, lineData);

          const series = ensureSeries(instance);
          if (series) {
            const latest = useChartIndicatorsStore
              .getState()
              .instances.find((item) => item.id === instance.id);

            series.setData(lineData);
            if (latest) {
              series.applyOptions(buildLineSeriesOptions(latest, definition));
            } else {
              series.applyOptions(buildLineSeriesOptions(instance, definition));
            }
          }

          setInstanceRuntime(instance.id, false, null);
        }
      } catch (cause) {
        if (generation !== fetchGenerationRef.current) {
          return;
        }

        const message =
          cause instanceof Error ? cause.message : "Failed to load indicator";

        for (const instance of visibleInstances) {
          setInstanceRuntime(instance.id, false, message);
        }
      }
    },
    [chartReady, chartRef, datafeedRef, ensureSeries, setInstanceRuntime],
  );

  useEffect(() => {
    const currentIds = new Set(allInstances.map((instance) => instance.id));

    for (const instanceId of seriesByIdRef.current.keys()) {
      if (!currentIds.has(instanceId)) {
        removeSeries(instanceId);
        clearCacheForInstance(instanceId);
      }
    }

    for (const instanceId of seriesByIdRef.current.keys()) {
      const instance = allInstances.find((item) => item.id === instanceId);
      if (instance && !isOverlayInstance(instance)) {
        removeSeries(instanceId);
        clearCacheForInstance(instanceId);
      }
    }

    if (!chartReady) {
      return;
    }

    for (const instance of instances) {
      syncSeriesVisibility(instance);
    }

    const visibleInstances = instances.filter((instance) => instance.visible);
    if (visibleInstances.length === 0) {
      return;
    }

    const needsFetch = visibleInstances.some((instance) => {
      const cacheKey = buildCacheKey(marketKey, instance);
      return !dataCacheRef.current.has(cacheKey);
    });

    if (needsFetch) {
      for (const instance of visibleInstances) {
        if (!dataCacheRef.current.has(buildCacheKey(marketKey, instance))) {
          clearCacheForInstance(instance.id);
        }
      }
      void fetchAndApply(instances, marketKey);
      return;
    }

    for (const instance of visibleInstances) {
      applyCachedData(instance, marketKey);
    }
  }, [
    applyCachedData,
    chartReady,
    clearCacheForInstance,
    datafeedRef,
    fetchAndApply,
    allInstances,
    instances,
    marketKey,
    removeSeries,
    syncSeriesVisibility,
  ]);

  useEffect(() => {
    const datafeed = datafeedRef.current;
    if (!datafeed) {
      return;
    }

    return datafeed.subscribe((event) => {
      if (event.type === "reset") {
        fetchGenerationRef.current += 1;
        dataCacheRef.current.clear();

        for (const series of seriesByIdRef.current.values()) {
          series.setData([]);
        }

        clearRuntime();
        return;
      }

      if (event.type !== "replace" && event.type !== "prepend") {
        return;
      }

      const visibleInstances = instances.filter((instance) => instance.visible);

      if (visibleInstances.length === 0) {
        return;
      }

      void fetchAndApply(instances, marketKey);
    });
  }, [clearRuntime, datafeedRef, fetchAndApply, instances, marketKey]);

  useEffect(() => {
    const dataCache = dataCacheRef.current;
    const seriesById = seriesByIdRef.current;

    return () => {
      fetchGenerationRef.current += 1;
      dataCache.clear();
      seriesById.clear();
    };
  }, []);
}
