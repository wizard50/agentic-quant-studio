"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineWidth,
} from "lightweight-charts";
import type { Datafeed } from "@/lib/chart";
import {
  extractValuedLinePoints,
  lineDataHasValues,
} from "@/lib/chart/mapSeries";
import {
  parseLineLayerDataFromPorts,
  paneIndexForLayer,
  type LayerSpec,
  type PaneSpec,
} from "@/lib/chart-block";

interface UsePortLineSeriesParams {
  chartRef: React.RefObject<IChartApi | null>;
  datafeedRef: React.RefObject<Datafeed>;
  chartReady: boolean;
  panes: PaneSpec[];
  layoutKey: string;
  /** When false, clears series and does nothing (document mode). */
  enabled: boolean;
}

function lineLayersFromPanes(panes: PaneSpec[]): LayerSpec[] {
  return panes.flatMap((pane) =>
    pane.layers.filter(
      (layer) => layer.visual === "line" && layer.ports.value,
    ),
  );
}

export function usePortLineSeries({
  chartRef,
  datafeedRef,
  chartReady,
  panes,
  layoutKey,
  enabled,
}: UsePortLineSeriesParams): void {
  const seriesByIdRef = useRef(new Map<string, ISeriesApi<"Line">>());
  const appliedGenerationRef = useRef(0);

  const lineLayers = useMemo(() => lineLayersFromPanes(panes), [panes]);

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
    (layer: LayerSpec): ISeriesApi<"Line"> | null => {
      const chart = chartRef.current;
      if (!chart || layer.visible === false) {
        return null;
      }

      let series = seriesByIdRef.current.get(layer.id);
      if (!series) {
        const paneIndex = paneIndexForLayer(panes, layer.id);
        const options = {
          color: layer.style?.color ?? "#f59e0b",
          lineWidth: (layer.style?.lineWidth ?? 2) as LineWidth,
          title: layer.label ?? layer.id,
        };
        series =
          paneIndex <= 0
            ? chart.addSeries(LineSeries, options)
            : chart.addSeries(LineSeries, options, paneIndex);
        seriesByIdRef.current.set(layer.id, series);
      }

      return series;
    },
    [chartRef, panes],
  );

  const applyFromViewport = useCallback(() => {
    if (!enabled || !chartReady) {
      return;
    }

    const feed = datafeedRef.current;
    const response = feed.getLastResponse();
    const candles = feed.getCandles();

    if (!response) {
      return;
    }

    const generation = ++appliedGenerationRef.current;

    for (const layer of lineLayers) {
      if (layer.visible === false) {
        removeSeries(layer.id);
        continue;
      }

      try {
        const lineData = parseLineLayerDataFromPorts(
          response,
          layer,
          candles,
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
        series.applyOptions({
          color: layer.style?.color ?? "#f59e0b",
          lineWidth: (layer.style?.lineWidth ?? 2) as LineWidth,
          visible: true,
        });
      } catch {
        if (generation !== appliedGenerationRef.current) {
          return;
        }
        removeSeries(layer.id);
      }
    }
  }, [
    chartReady,
    datafeedRef,
    enabled,
    ensureSeries,
    lineLayers,
    removeSeries,
  ]);

  useEffect(() => {
    for (const layerId of [...seriesByIdRef.current.keys()]) {
      removeSeries(layerId);
    }
  }, [layoutKey, removeSeries]);

  useEffect(() => {
    if (!enabled) {
      for (const layerId of [...seriesByIdRef.current.keys()]) {
        removeSeries(layerId);
      }
      return;
    }

    const currentIds = new Set(lineLayers.map((layer) => layer.id));
    for (const layerId of seriesByIdRef.current.keys()) {
      if (!currentIds.has(layerId)) {
        removeSeries(layerId);
      }
    }

    applyFromViewport();
  }, [applyFromViewport, enabled, lineLayers, removeSeries, layoutKey]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return datafeedRef.current.subscribe((event) => {
      if (event.type === "reset") {
        appliedGenerationRef.current += 1;
        for (const layerId of [...seriesByIdRef.current.keys()]) {
          removeSeries(layerId);
        }
        return;
      }

      if (event.type === "replace" || event.type === "prepend") {
        applyFromViewport();
      }
    });
  }, [applyFromViewport, datafeedRef, enabled, removeSeries]);

  useEffect(() => {
    const seriesById = seriesByIdRef.current;
    return () => {
      appliedGenerationRef.current += 1;
      seriesById.clear();
    };
  }, []);
}
