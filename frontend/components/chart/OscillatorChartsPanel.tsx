"use client";

import type { IChartApi } from "lightweight-charts";
import { OscillatorChartBox } from "@/components/chart/OscillatorChartBox";
import { useChartStackSync } from "@/hooks/chart/useChartStackSync";
import { filterOscillatorInstances } from "@/lib/indicators";
import type { SeriesKey } from "@/lib/chart";
import type { CandleDatafeed } from "@/lib/chart/datafeed";
import { useChartIndicatorsStore } from "@/stores/useChartIndicatorsStore";

interface OscillatorChartsPanelProps {
  mainChartRef: React.RefObject<IChartApi | null>;
  datafeedRef: React.RefObject<CandleDatafeed>;
  marketKey: SeriesKey;
  chartReady: boolean;
}

export function OscillatorChartsPanel({
  mainChartRef,
  datafeedRef,
  marketKey,
  chartReady,
}: OscillatorChartsPanelProps) {
  const instances = useChartIndicatorsStore((state) => state.instances);
  const oscillatorInstances = filterOscillatorInstances(instances);
  const stackSync = useChartStackSync({
    mainChartRef,
    enabled: chartReady && oscillatorInstances.length > 0,
  });

  if (oscillatorInstances.length === 0) {
    return null;
  }

  const lastIndex = oscillatorInstances.length - 1;

  return (
    <div className="flex shrink-0 flex-col gap-3">
      {oscillatorInstances.map((instance, index) => (
        <OscillatorChartBox
          key={instance.id}
          instance={instance}
          datafeedRef={datafeedRef}
          marketKey={marketKey}
          chartReady={chartReady}
          showTimeScale={index === lastIndex}
          stackSync={stackSync}
        />
      ))}
    </div>
  );
}
