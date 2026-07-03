import { findChartLayer, type ChartLayer } from "./layers";
import { useChartLayersStore } from "@/stores/useChartLayersStore";
import type { LayerSpec, PaneSpec } from "./types";

export function isChartLayerInLegend(
  layerId: string,
  chartLayers: ChartLayer[],
): boolean {
  const chartLayer = findChartLayer(chartLayers, layerId);
  if (!chartLayer) {
    return false;
  }

  return chartLayer.kind === "market" || chartLayer.kind === "indicator";
}

export function filterLegendLayers(
  paneLayers: LayerSpec[],
  chartLayers: ChartLayer[],
): LayerSpec[] {
  return paneLayers.filter((layer) =>
    isChartLayerInLegend(layer.id, chartLayers),
  );
}

export function paneHasLegendLayers(
  pane: PaneSpec,
  chartLayers: ChartLayer[],
): boolean {
  return filterLegendLayers(pane.layers, chartLayers).length > 0;
}

export function getLayerLegendLabel(layer: LayerSpec): string {
  if (layer.label) {
    return layer.label;
  }

  if (layer.visual === "candlestick" || layer.visual === "bar") {
    return "Candles";
  }

  if (layer.visual === "histogram") {
    return "Volume";
  }

  return layer.id;
}

export function getLayerDefaultVisible(layer: LayerSpec): boolean {
  return layer.visible !== false;
}

export function resolveLayerVisible(
  layerId: string,
  defaultVisible: boolean,
): boolean {
  const layer = findChartLayer(useChartLayersStore.getState().layers, layerId);
  return layer?.visible ?? defaultVisible;
}
