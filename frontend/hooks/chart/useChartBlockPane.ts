"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi } from "lightweight-charts";
import {
  createBlockChart,
  handleBlockChartDatafeedEvent,
  hydrateBlockChart,
  type BlockChartSeries,
  type Datafeed,
} from "@/lib/chart";
import {
  applyPaneLayoutToChart,
  paneLayoutKey,
  type PaneSpec,
} from "@/lib/chart-block";
import { useBlockNativeLayers } from "./useBlockNativeLayers";
import { useChartHistoryScroll } from "./useChartHistoryScroll";
import { useChartResize } from "./useChartResize";
import { useLineLayerSeries } from "./useLineLayerSeries";
import { useMarkerLayers } from "./useMarkerLayers";
import { usePortLineSeries } from "./usePortLineSeries";

export interface UseChartBlockPaneParams {
  panes: PaneSpec[];
  datafeedRef: React.RefObject<Datafeed>;
  chartReady: boolean;
  mainChartRef: React.RefObject<IChartApi | null>;
  /** When true, render lines from pane LayerSpecs (study mode). */
  studyMode?: boolean;
}

export function useChartBlockPane({
  panes,
  datafeedRef,
  chartReady,
  mainChartRef,
  studyMode = false,
}: UseChartBlockPaneParams) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<BlockChartSeries | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [chartRevision, setChartRevision] = useState(0);

  const layoutKey = useMemo(() => paneLayoutKey(panes), [panes]);
  const paneSnapshot = useMemo(
    () => panes,
    // Snapshot updates only when pane topology changes, not on param-only updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- panes read when layoutKey changes
    [layoutKey],
  );
  const resizeRevision = `${layoutKey}:${chartRevision}`;

  const syncFromFeedCache = useCallback(() => {
    hydrateBlockChart(seriesRef.current, datafeedRef.current.getCandles());
  }, [datafeedRef]);

  const applyLayout = useCallback(() => {
    const series = seriesRef.current;
    const chartApi = series?.chart;
    const container = containerRef.current;
    if (!series || !chartApi || !container) {
      return;
    }

    const height = container.clientHeight;
    if (height <= 0) {
      return;
    }

    applyPaneLayoutToChart(chartApi, panes, height);
  }, [panes]);

  const handleContainerResize = useCallback((height: number) => {
    setContainerHeight(height);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const mainPane = paneSnapshot.find((pane) => pane.role === "main");
    if (!container || !mainPane) {
      return;
    }

    const series = createBlockChart(container, paneSnapshot);
    seriesRef.current = series;
    mainChartRef.current = series.chart;
    syncFromFeedCache();
    setChartRevision((revision) => revision + 1);

    return () => {
      const chartToRemove = series.chart;
      seriesRef.current = null;
      mainChartRef.current = null;
      chartToRemove.remove();
    };
  }, [mainChartRef, paneSnapshot, syncFromFeedCache]);

  useEffect(() => {
    if (!seriesRef.current?.chart) {
      return;
    }

    applyLayout();
  }, [applyLayout, layoutKey, chartRevision]);

  useEffect(() => {
    const unsubscribe = datafeedRef.current.subscribe((event) => {
      handleBlockChartDatafeedEvent(event, {
        chart: seriesRef.current?.chart ?? null,
        series: seriesRef.current,
      });
    });

    syncFromFeedCache();

    return unsubscribe;
  }, [datafeedRef, syncFromFeedCache]);

  useChartResize({
    containerRef,
    seriesRef,
    revision: resizeRevision,
    onContainerResize: handleContainerResize,
    onResized: applyLayout,
  });
  useChartHistoryScroll(seriesRef, datafeedRef, chartReady, resizeRevision);
  useBlockNativeLayers(seriesRef, panes, chartReady, resizeRevision);

  useLineLayerSeries({
    chartRef: mainChartRef,
    datafeedRef,
    chartReady: chartReady && !studyMode,
    panes,
    layoutKey,
  });

  usePortLineSeries({
    chartRef: mainChartRef,
    datafeedRef,
    chartReady,
    panes,
    layoutKey,
    enabled: studyMode,
  });

  useMarkerLayers({
    chartRef: mainChartRef,
    seriesRef,
    datafeedRef,
    chartReady,
    panes,
    layoutKey,
    enabled: studyMode,
  });

  return {
    containerRef,
    containerHeight,
  };
}
