"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
} from "lightweight-charts";
import {
  alignLineSeriesToCandles,
  type LineSeriesPoint,
} from "@/lib/chart/mapSeries";
import { createOscillatorChart, PAGE_SIZE } from "@/lib/chart";
import type { CandleDatafeed } from "@/lib/chart/datafeed";
import type { SeriesKey } from "@/lib/chart";
import {
  buildIndicatorDataRange,
  buildIndicatorRunRequest,
  buildLineSeriesOptions,
  INDICATOR_REGISTRY,
  isOscillatorInstance,
} from "@/lib/indicators";
import type { IndicatorInstance } from "@/lib/indicators";
import { runStudioGraph } from "@/lib/studio/api";
import { useChartIndicatorsStore } from "@/stores/useChartIndicatorsStore";
import { useChartResize } from "./useChartResize";
import type { ChartStackSyncApi } from "./useChartStackSync";

interface UseOscillatorChartParams {
  instance: IndicatorInstance;
  containerRef: React.RefObject<HTMLDivElement | null>;
  datafeedRef: React.RefObject<CandleDatafeed>;
  marketKey: SeriesKey;
  chartReady: boolean;
  showTimeScale?: boolean;
  stackSync: ChartStackSyncApi;
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

export function useOscillatorChart({
  instance,
  containerRef,
  datafeedRef,
  marketKey,
  chartReady,
  showTimeScale = true,
  stackSync,
}: UseOscillatorChartParams): void {
  const setRuntime = useChartIndicatorsStore((state) => state.setRuntime);
  const clearRuntime = useChartIndicatorsStore((state) => state.clearRuntime);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const cacheKeyRef = useRef<string | null>(null);
  const dataCacheRef = useRef<LineSeriesPoint[] | null>(null);
  const fetchGenerationRef = useRef(0);
  const [chartMounted, setChartMounted] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const { chart } = createOscillatorChart(container);
    chartRef.current = chart;
    setChartMounted(true);

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setChartMounted(false);
      setDataReady(false);
    };
  }, [containerRef]);

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chartMounted || !dataReady || !chart) {
      stackSync.registerOscillatorChart(instance.id, null);
      return;
    }

    stackSync.registerOscillatorChart(instance.id, chart);

    return () => {
      stackSync.registerOscillatorChart(instance.id, null);
    };
  }, [chartMounted, dataReady, instance.id, stackSync]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: {
        visible: showTimeScale,
        timeVisible: showTimeScale,
      },
    });
  }, [showTimeScale]);

  useChartResize(containerRef, chartRef);

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chartMounted || !dataReady || !chart) {
      return;
    }

    const onRangeChange = (range: LogicalRange | null) => {
      if (!range || stackSync.isProxyLocked()) {
        return;
      }

      stackSync.runOscillatorScroll(instance.id, range);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
    };
  }, [chartMounted, dataReady, instance.id, stackSync]);

  const setInstanceRuntime = useCallback(
    (loading: boolean, error: string | null) => {
      setRuntime(instance.id, { loading, error });
    },
    [instance.id, setRuntime],
  );

  const ensureSeries = useCallback((): ISeriesApi<"Line"> | null => {
    const chart = chartRef.current;
    const definition = INDICATOR_REGISTRY[instance.kind];
    if (!chart || !definition) {
      return null;
    }

    if (!seriesRef.current) {
      seriesRef.current = chart.addSeries(
        LineSeries,
        buildLineSeriesOptions(instance, definition),
      );
    }

    return seriesRef.current;
  }, [instance]);

  const applySeriesOptions = useCallback((target: IndicatorInstance) => {
    const definition = INDICATOR_REGISTRY[target.kind];
    const series = seriesRef.current;
    if (!definition || !series) {
      return;
    }

    series.applyOptions(buildLineSeriesOptions(target, definition));
  }, []);

  const fetchAndApply = useCallback(
    async (target: IndicatorInstance) => {
      const chart = chartRef.current;
      const datafeed = datafeedRef.current;
      if (
        !chart ||
        !chartReady ||
        !target.visible ||
        !isOscillatorInstance(target)
      ) {
        return;
      }

      const dataRange = buildIndicatorDataRange(datafeed, [target]);
      const request = buildIndicatorRunRequest({
        settings: marketKey,
        instances: [target],
        limit: dataRange?.limit ?? PAGE_SIZE,
        startMs: dataRange?.startMs,
        endMs: dataRange?.endMs,
      });

      if (!request) {
        return;
      }

      const generation = ++fetchGenerationRef.current;
      setInstanceRuntime(true, null);

      try {
        const response = await runStudioGraph(request);

        if (generation !== fetchGenerationRef.current) {
          return;
        }

        const definition = INDICATOR_REGISTRY[target.kind];
        if (!definition) {
          return;
        }

        const parsed = definition.parseLineData(response, target.id, "ds1");
        const lineData = alignLineSeriesToCandles(
          datafeed.getCandles(),
          parsed,
        );
        cacheKeyRef.current = buildCacheKey(marketKey, target);
        dataCacheRef.current = lineData;

        const series = ensureSeries();
        if (series) {
          const latest = useChartIndicatorsStore
            .getState()
            .instances.find((item) => item.id === target.id);

          series.setData(lineData);
          applySeriesOptions(latest ?? target);
          setDataReady(lineData.length > 0);
        }

        setInstanceRuntime(false, null);
      } catch (cause) {
        if (generation !== fetchGenerationRef.current) {
          return;
        }

        const message =
          cause instanceof Error ? cause.message : "Failed to load indicator";
        setInstanceRuntime(false, message);
      }
    },
    [
      applySeriesOptions,
      chartReady,
      datafeedRef,
      ensureSeries,
      marketKey,
      setInstanceRuntime,
    ],
  );

  useEffect(() => {
    if (!chartReady || !isOscillatorInstance(instance)) {
      return;
    }

    const series = instance.visible ? ensureSeries() : seriesRef.current;

    if (series) {
      applySeriesOptions(instance);
    }

    if (!instance.visible) {
      return;
    }

    const cacheKey = buildCacheKey(marketKey, instance);
    const hasCachedData =
      cacheKeyRef.current === cacheKey && dataCacheRef.current != null;

    if (hasCachedData && dataCacheRef.current) {
      const activeSeries = ensureSeries();
      activeSeries?.setData(dataCacheRef.current);
      applySeriesOptions(instance);
      setDataReady(dataCacheRef.current.length > 0);
      return;
    }

    cacheKeyRef.current = null;
    dataCacheRef.current = null;
    setDataReady(false);
    void fetchAndApply(instance);
  }, [
    applySeriesOptions,
    chartReady,
    datafeedRef,
    ensureSeries,
    fetchAndApply,
    instance,
    marketKey,
  ]);

  useEffect(() => {
    const datafeed = datafeedRef.current;
    if (!datafeed) {
      return;
    }

    return datafeed.subscribe((event) => {
      if (event.type === "reset") {
        fetchGenerationRef.current += 1;
        cacheKeyRef.current = null;
        dataCacheRef.current = null;
        seriesRef.current?.setData([]);
        setDataReady(false);
        clearRuntime();
        return;
      }

      if (event.type !== "replace" && event.type !== "prepend") {
        return;
      }

      if (!instance.visible) {
        return;
      }

      void fetchAndApply(instance);
    });
  }, [clearRuntime, datafeedRef, fetchAndApply, instance]);

  useEffect(() => {
    return () => {
      fetchGenerationRef.current += 1;
      cacheKeyRef.current = null;
      dataCacheRef.current = null;
    };
  }, []);
}
