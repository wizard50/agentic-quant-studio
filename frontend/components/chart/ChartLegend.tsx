"use client";

import { IndicatorLayerRow } from "./IndicatorLayerRow";
import { useChartIndicatorsStore } from "@/stores/useChartIndicatorsStore";

interface ChartLegendProps {
  visible: boolean;
}

export function ChartLegend({ visible }: ChartLegendProps) {
  const instances = useChartIndicatorsStore((state) => state.instances);

  if (!visible || instances.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute top-3 left-3 z-5 max-h-36 w-56">
      <div
        className="pointer-events-auto flex max-h-36 flex-col gap-0.5 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/85 px-2 py-2 shadow-lg backdrop-blur-sm"
        role="list"
        aria-label="Chart indicators"
      >
        {instances.map((instance) => (
          <IndicatorLayerRow key={instance.id} instance={instance} />
        ))}
      </div>
    </div>
  );
}
