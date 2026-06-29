"use client";

import { useCandleChart, type UseCandleChartParams } from "@/hooks/chart";
import { ChartLegend } from "@/components/chart/ChartLegend";
import { OscillatorChartsPanel } from "@/components/chart/OscillatorChartsPanel";
import { cn } from "@/lib/utils";

interface CandleChartPanelProps extends UseCandleChartParams {
  className?: string;
}

export function CandleChartPanel({
  className,
  ...params
}: CandleChartPanelProps) {
  const { containerRef, chartRef, datafeedRef, marketKey, status, error } =
    useCandleChart(params);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-6",
        className,
      )}
    >
      <div className="relative min-h-60 flex-1 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
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

      <OscillatorChartsPanel
        mainChartRef={chartRef}
        datafeedRef={datafeedRef}
        marketKey={marketKey}
        chartReady={status === "ready"}
      />
    </div>
  );
}
