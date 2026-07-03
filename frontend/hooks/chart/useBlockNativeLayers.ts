"use client";

import { useEffect, type RefObject } from "react";
import {
  buildHistogramSeriesOptionsFromLayer,
  getLayerDefaultVisible,
  resolveLayerVisible,
  type LayerSpec,
  type PaneSpec,
} from "@/lib/chart-block";
import { getLayerSeries, type BlockChartSeries } from "@/lib/chart";
import { useChartLayersStore } from "@/stores/useChartLayersStore";

function isNativeLayer(layer: LayerSpec): boolean {
  return layer.visual === "candlestick" || layer.visual === "histogram";
}

export function useBlockNativeLayers(
  seriesRef: RefObject<BlockChartSeries | null>,
  panes: PaneSpec[],
  chartReady: boolean,
  revision: string,
): void {
  const layers = useChartLayersStore((state) => state.layers);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series?.chart || !chartReady) {
      return;
    }

    for (const pane of panes) {
      for (const layer of pane.layers) {
        if (!isNativeLayer(layer)) {
          continue;
        }

        const layerSeries = getLayerSeries(series, layer.id);
        if (!layerSeries) {
          continue;
        }

        const visible = resolveLayerVisible(
          layer.id,
          getLayerDefaultVisible(layer),
        );

        if (layer.visual === "histogram") {
          layerSeries.applyOptions(
            buildHistogramSeriesOptionsFromLayer(layer, visible),
          );
          continue;
        }

        layerSeries.applyOptions({ visible });
      }
    }
  }, [chartReady, panes, revision, seriesRef, layers]);
}
