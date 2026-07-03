"use client";

import { LayerLegendRow } from "@/components/chart/LayerLegendRow";
import { filterLegendLayers } from "@/lib/chart-block";
import type { PaneSpec } from "@/lib/chart-block";
import { useChartLayersStore } from "@/stores/useChartLayersStore";

interface PaneLegendProps {
  pane: PaneSpec;
}

export function PaneLegend({ pane }: PaneLegendProps) {
  const chartLayers = useChartLayersStore((state) => state.layers);
  const legendLayers = filterLegendLayers(pane.layers, chartLayers);

  if (legendLayers.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto flex max-w-48 flex-col gap-px rounded-md border border-zinc-800/80 bg-zinc-950/95 px-1 py-0.5 shadow-md backdrop-blur-sm"
      role="list"
      aria-label={`${pane.id} chart layers`}
    >
      {legendLayers.map((layer) => (
        <LayerLegendRow key={layer.id} layer={layer} />
      ))}
    </div>
  );
}
