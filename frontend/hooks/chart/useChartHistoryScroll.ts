"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { LogicalRange } from "lightweight-charts";
import {
  LOAD_OLDER_DEBOUNCE_MS,
  shouldLoadOlderHistory,
} from "@/lib/chart/preserveViewport";
import {
  getCandlesSeries,
  type BlockChartSeries,
  type HistoryScrollFeed,
} from "@/lib/chart";

export function useChartHistoryScroll(
  seriesRef: RefObject<BlockChartSeries | null>,
  datafeedRef: RefObject<HistoryScrollFeed>,
  enabled: boolean,
  revision: string,
): void {
  const loadOlderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const chart = seriesRef.current?.chart;
    const candles = getCandlesSeries(seriesRef.current);
    if (!chart || !candles) {
      return;
    }

    const scheduleLoadOlder = (range: LogicalRange | null) => {
      if (!range || !datafeedRef.current.getHasMoreHistory()) {
        return;
      }

      const barsInfo = candles.barsInLogicalRange(range);
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
  }, [enabled, revision, seriesRef, datafeedRef]);
}
