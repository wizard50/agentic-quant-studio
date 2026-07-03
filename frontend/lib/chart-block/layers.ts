import type { IndicatorParams } from "@/lib/indicators/types";

export type ChartLayerKind = "market" | "indicator";

export type MarketSeriesStyle = "candlestick" | "bar";

export interface MarketChartLayer {
  id: string;
  kind: "market";
  visible: boolean;
  seriesStyle: MarketSeriesStyle;
  label?: string;
}

export interface IndicatorChartLayer {
  id: string;
  kind: "indicator";
  visible: boolean;
  indicatorKind: string;
  params: IndicatorParams;
  color: string;
}

export type ChartLayer = MarketChartLayer | IndicatorChartLayer;

export interface ChartLayerStatus {
  loading: boolean;
  error: string | null;
}

export const MARKET_LAYER_ID = "candles";

export function createDefaultMarketLayer(): MarketChartLayer {
  return {
    id: MARKET_LAYER_ID,
    kind: "market",
    visible: true,
    seriesStyle: "candlestick",
  };
}

export function isMarketChartLayer(
  layer: ChartLayer,
): layer is MarketChartLayer {
  return layer.kind === "market";
}

export function isIndicatorChartLayer(
  layer: ChartLayer,
): layer is IndicatorChartLayer {
  return layer.kind === "indicator";
}

export function filterIndicatorLayers(
  layers: ChartLayer[],
): IndicatorChartLayer[] {
  return layers.filter(isIndicatorChartLayer);
}

export function findChartLayer(
  layers: ChartLayer[],
  id: string,
): ChartLayer | undefined {
  return layers.find((layer) => layer.id === id);
}
