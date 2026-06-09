"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { IChartApi, LogicalRange } from "lightweight-charts";
import {
  LOAD_OLDER_DEBOUNCE_MS,
  shouldLoadOlderHistory,
} from "@/lib/chart/preserveViewport";
import type { CandleDatafeed, ChartSeries } from "@/lib/chart";

export function useChartHistoryScroll(
  chartRef: RefObject<IChartApi | null>,
  seriesRef: RefObject<ChartSeries | null>,
  datafeedRef: RefObject<CandleDatafeed>,
  enabled: boolean,
): void {
  const loadOlderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) {
      return;
    }

    const scheduleLoadOlder = (range: LogicalRange | null) => {
      if (!range || !datafeedRef.current.getHasMoreHistory()) {
        return;
      }

      const barsInfo = series.candles.barsInLogicalRange(range);
      if (!shouldLoadOlderHistory(barsInfo?.barsBefore)) {
        return;
      }

      if (loadOlderTimerRef.current) {
        clearTimeout(loadOlderTimerRef.current);
      }

      loadOlderTimerRef.current = setTimeout(() => {
        loadOlderTimerRef.current = null;
        void datafeedRef.current.loadOlder();
      }, LOAD_OLDER_DEBOUNCE_MS);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleLoadOlder);

    return () => {
      if (loadOlderTimerRef.current) {
        clearTimeout(loadOlderTimerRef.current);
        loadOlderTimerRef.current = null;
      }
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(scheduleLoadOlder);
    };
  }, [chartRef, seriesRef, datafeedRef, enabled]);
}
