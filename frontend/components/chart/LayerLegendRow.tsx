"use client";

import { IndicatorLayerRow } from "@/components/chart/IndicatorLayerRow";
import { BaseLayerLegendRow } from "@/components/chart/BaseLayerLegendRow";
import { findChartLayer, type LayerSpec } from "@/lib/chart-block";
import { useChartLayersStore } from "@/stores/useChartLayersStore";

interface LayerLegendRowProps {
  layer: LayerSpec;
}

export function LayerLegendRow({ layer }: LayerLegendRowProps) {
  const chartLayer = useChartLayersStore((state) =>
    findChartLayer(state.layers, layer.id),
  );

  if (!chartLayer) {
    return null;
  }

  if (chartLayer.kind === "market") {
    return <BaseLayerLegendRow layer={layer} />;
  }

  if (chartLayer.kind === "indicator") {
    return <IndicatorLayerRow layer={chartLayer} />;
  }

  return null;
}
