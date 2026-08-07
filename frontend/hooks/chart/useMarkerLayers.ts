"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesType,
  type Time,
} from "lightweight-charts";
import type { BlockChartSeries, Datafeed } from "@/lib/chart";
import { getCandlesSeries } from "@/lib/chart";
import {
  parseMarkerLayerData,
  paneIndexForLayer,
  type LayerSpec,
  type PaneSpec,
} from "@/lib/chart-block";

interface UseMarkerLayersParams {
  chartRef: React.RefObject<IChartApi | null>;
  seriesRef: React.RefObject<BlockChartSeries | null>;
  datafeedRef: React.RefObject<Datafeed>;
  chartReady: boolean;
  panes: PaneSpec[];
  layoutKey: string;
  enabled: boolean;
}

function markerLayersFromPanes(panes: PaneSpec[]): LayerSpec[] {
  return panes.flatMap((pane) =>
    pane.layers.filter(
      (layer) => layer.visual === "markers" && layer.ports.signal,
    ),
  );
}

function findAnchorSeries(
  chart: IChartApi,
  seriesBundle: BlockChartSeries | null,
  paneIndex: number,
): ISeriesApi<SeriesType> | null {
  if (paneIndex <= 0) {
    const candles = getCandlesSeries(seriesBundle);
    if (candles) {
      return candles;
    }
  }

  const pane = chart.panes()[paneIndex];
  if (!pane) {
    return null;
  }

  const seriesList = pane.getSeries();
  const line = seriesList.find((series) => series.seriesType() === "Line");
  if (line) {
    return line;
  }

  return seriesList[0] ?? null;
}

export function useMarkerLayers({
  chartRef,
  seriesRef,
  datafeedRef,
  chartReady,
  panes,
  layoutKey,
  enabled,
}: UseMarkerLayersParams): void {
  const pluginsByLayerIdRef = useRef(
    new Map<string, ISeriesMarkersPluginApi<Time>>(),
  );
  const appliedGenerationRef = useRef(0);
  const retryHandleRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const applyFromViewportRef = useRef<(isRetry?: boolean) => void>(() => {});

  const markerLayers = useMemo(() => markerLayersFromPanes(panes), [panes]);

  const clearAllPlugins = useCallback(() => {
    for (const plugin of pluginsByLayerIdRef.current.values()) {
      try {
        plugin.setMarkers([]);
        plugin.detach();
      } catch {
        // Chart disposed or plugin already detached.
      }
    }
    pluginsByLayerIdRef.current.clear();
  }, []);

  const clearPlugin = useCallback((layerId: string) => {
    const plugin = pluginsByLayerIdRef.current.get(layerId);
    if (!plugin) {
      return;
    }
    try {
      plugin.setMarkers([]);
      plugin.detach();
    } catch {
      // Chart disposed or plugin already detached.
    }
    pluginsByLayerIdRef.current.delete(layerId);
  }, []);

  const applyFromViewport = useCallback(
    (isRetry = false) => {
      if (!enabled || !chartReady) {
        return;
      }

      const chart = chartRef.current;
      const feed = datafeedRef.current;
      const response = feed.getLastResponse();

      if (!chart || !response) {
        return;
      }

      if (!isRetry) {
        retryCountRef.current = 0;
      }

      const generation = ++appliedGenerationRef.current;
      let needsRetry = false;

      for (const layer of markerLayers) {
        if (layer.visible === false) {
          clearPlugin(layer.id);
          continue;
        }

        try {
          const markers = parseMarkerLayerData(response, layer);

          if (generation !== appliedGenerationRef.current) {
            return;
          }

          if (!markers || markers.length === 0) {
            const existing = pluginsByLayerIdRef.current.get(layer.id);
            if (existing) {
              existing.setMarkers([]);
            }
            continue;
          }

          const paneIndex = paneIndexForLayer(panes, layer.id);
          if (paneIndex < 0) {
            clearPlugin(layer.id);
            continue;
          }

          const anchor = findAnchorSeries(chart, seriesRef.current, paneIndex);
          if (!anchor) {
            needsRetry = true;
            clearPlugin(layer.id);
            continue;
          }

          let plugin = pluginsByLayerIdRef.current.get(layer.id);
          if (!plugin) {
            plugin = createSeriesMarkers(anchor, markers);
            pluginsByLayerIdRef.current.set(layer.id, plugin);
          } else {
            plugin.setMarkers(markers);
          }
        } catch {
          if (generation !== appliedGenerationRef.current) {
            return;
          }
          clearPlugin(layer.id);
        }
      }

      // Port line series may attach one frame later; retry a few times.
      if (
        needsRetry &&
        generation === appliedGenerationRef.current &&
        retryCountRef.current < 3
      ) {
        retryCountRef.current += 1;
        if (retryHandleRef.current != null) {
          cancelAnimationFrame(retryHandleRef.current);
        }
        retryHandleRef.current = requestAnimationFrame(() => {
          retryHandleRef.current = null;
          if (generation === appliedGenerationRef.current) {
            applyFromViewportRef.current(true);
          }
        });
      }
    },
    [
      chartReady,
      chartRef,
      clearPlugin,
      datafeedRef,
      enabled,
      markerLayers,
      panes,
      seriesRef,
    ],
  );

  useEffect(() => {
    applyFromViewportRef.current = applyFromViewport;
  }, [applyFromViewport]);

  useEffect(() => {
    clearAllPlugins();
  }, [layoutKey, clearAllPlugins]);

  useEffect(() => {
    if (!enabled) {
      clearAllPlugins();
      return;
    }

    const currentIds = new Set(markerLayers.map((layer) => layer.id));
    for (const layerId of pluginsByLayerIdRef.current.keys()) {
      if (!currentIds.has(layerId)) {
        clearPlugin(layerId);
      }
    }

    applyFromViewport();
  }, [
    applyFromViewport,
    clearAllPlugins,
    clearPlugin,
    enabled,
    markerLayers,
    layoutKey,
  ]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return datafeedRef.current.subscribe((event) => {
      if (event.type === "reset") {
        appliedGenerationRef.current += 1;
        clearAllPlugins();
        return;
      }

      if (event.type === "replace" || event.type === "prepend") {
        applyFromViewport();
      }
    });
  }, [applyFromViewport, clearAllPlugins, datafeedRef, enabled]);

  useEffect(() => {
    return () => {
      appliedGenerationRef.current += 1;
      if (retryHandleRef.current != null) {
        cancelAnimationFrame(retryHandleRef.current);
        retryHandleRef.current = null;
      }
      clearAllPlugins();
    };
  }, [clearAllPlugins]);
}
