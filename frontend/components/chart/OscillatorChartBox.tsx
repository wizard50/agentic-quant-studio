"use client";

import { useRef } from "react";
import { IndicatorLayerRow } from "@/components/chart/IndicatorLayerRow";
import { useOscillatorChart } from "@/hooks/chart/useOscillatorChart";
import type { ChartStackSyncApi } from "@/hooks/chart/useChartStackSync";
import type { CandleDatafeed } from "@/lib/chart/datafeed";
import type { SeriesKey } from "@/lib/chart";
import type { IndicatorInstance } from "@/lib/indicators";
import { cn } from "@/lib/utils";

interface OscillatorChartBoxProps {
  instance: IndicatorInstance;
  datafeedRef: React.RefObject<CandleDatafeed>;
  marketKey: SeriesKey;
  chartReady: boolean;
  showTimeScale?: boolean;
  stackSync: ChartStackSyncApi;
  className?: string;
}

export function OscillatorChartBox({
  instance,
  datafeedRef,
  marketKey,
  chartReady,
  showTimeScale = true,
  stackSync,
  className,
}: OscillatorChartBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useOscillatorChart({
    instance,
    containerRef,
    datafeedRef,
    marketKey,
    chartReady,
    showTimeScale,
    stackSync,
  });

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950",
        className,
      )}
    >
      <div className="border-b border-zinc-800/80 px-2 py-1">
        <IndicatorLayerRow instance={instance} />
      </div>

      <div
        ref={containerRef}
        className={cn("h-36 w-full touch-none", !showTimeScale && "pb-1")}
        aria-label={`${instance.kind} chart`}
      />
    </div>
  );
}
