"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { IChartApi } from "lightweight-charts";
import {
  CandleDatafeed,
  createChartWithSeries,
  handleDatafeedEvent,
} from "@/lib/chart";
import type { ChartSeries, ChartStatus, SeriesKey } from "@/lib/chart";
import { useChartHistoryScroll } from "./useChartHistoryScroll";
import { useChartResize } from "./useChartResize";

export interface UseCandleChartParams {
  exchange: string;
  category: string;
  symbol: string;
  interval: string;
}

export interface UseCandleChartResult {
  containerRef: RefObject<HTMLDivElement | null>;
  status: ChartStatus;
  error: Error | null;
}

export function useCandleChart(
  params: UseCandleChartParams,
): UseCandleChartResult {
  const { exchange, category, symbol, interval } = params;

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ChartSeries | null>(null);
  const datafeedRef = useRef(new CandleDatafeed());

  const [status, setStatus] = useState<ChartStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const series = createChartWithSeries(container);
    seriesRef.current = series;
    chartRef.current = series.chart;

    return () => {
      series.chart.remove();
      seriesRef.current = null;
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const datafeed = datafeedRef.current;

    return datafeed.subscribe((event) => {
      handleDatafeedEvent(
        event,
        {
          chart: chartRef.current,
          series: seriesRef.current,
        },
        {
          onLoading: () => {
            setStatus("loading");
            setError(null);
          },
        },
      );
    });
  }, []);

  useEffect(() => {
    if (!symbol) {
      return;
    }

    const datafeed = datafeedRef.current;
    const key: SeriesKey = {
      exchange,
      category,
      symbol,
      interval,
    };

    datafeed.reset(key);

    let cancelled = false;

    datafeed.loadInitial().then(
      () => {
        if (!cancelled) {
          setStatus("ready");
        }
      },
      (cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
          setStatus("error");
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [exchange, category, symbol, interval]);

  const displayStatus: ChartStatus = symbol ? status : "idle";
  const displayError = symbol ? error : null;

  useChartHistoryScroll(
    chartRef,
    seriesRef,
    datafeedRef,
    displayStatus === "ready",
  );
  useChartResize(containerRef, chartRef);

  return {
    containerRef,
    status: displayStatus,
    error: displayError,
  };
}
