"use client";

import { useCandleChart, type UseCandleChartParams } from "@/hooks/chart";
import { ChartLegend } from "@/components/chart/ChartLegend";
import { cn } from "@/lib/utils";

interface CandleChartPanelProps extends UseCandleChartParams {
  className?: string;
}

export function CandleChartPanel({
  className,
  ...params
}: CandleChartPanelProps) {
  const { containerRef, status, error } = useCandleChart(params);

  return (
    <div className={cn("flex-1 p-6 overflow-hidden flex flex-col", className)}>
      <div className="relative flex-1 border border-zinc-800 rounded-3xl overflow-hidden bg-zinc-950">
        <div ref={containerRef} className="absolute inset-0" />

        <ChartLegend visible={status === "ready"} />

        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80 text-zinc-400">
            Loading candles...
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-950/30 text-red-400">
            Failed to load candles — is your Axum backend running?
            {error && <span className="sr-only">{error.message}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
