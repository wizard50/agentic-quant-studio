import type { HistogramSeriesPartialOptions } from "lightweight-charts";
import { CHART_COLORS } from "@/lib/chart/theme";
import { getLayerDefaultVisible, resolveLayerVisible } from "./layerLegend";
import type { LayerSpec } from "./types";

export function buildHistogramSeriesOptionsFromLayer(
  layer: LayerSpec,
  visible?: boolean,
): HistogramSeriesPartialOptions {
  const resolvedVisible =
    visible ??
    resolveLayerVisible(layer.id, getLayerDefaultVisible(layer));

  return {
    color: layer.style?.color ?? CHART_COLORS.volume,
    priceFormat: { type: "volume" },
    visible: resolvedVisible,
  };
}

export function paneIndexForLayer(panes: { layers: LayerSpec[] }[], layerId: string): number {
  return panes.findIndex((pane) =>
    pane.layers.some((layer) => layer.id === layerId),
  );
}
