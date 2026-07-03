"use client";

import { useMemo } from "react";
import { PaneLegend } from "@/components/chart/PaneLegend";
import { useChartBlockPane } from "@/hooks/chart/useChartBlockPane";
import {
  useChartBlockData,
  type UseChartBlockDataParams,
} from "@/hooks/chart/useChartBlockData";
import { computePaneTopOffsets, paneHasLegendLayers } from "@/lib/chart-block";
import { cn } from "@/lib/utils";
import { useChartLayersStore } from "@/stores/useChartLayersStore";

export interface ChartBlockProps extends UseChartBlockDataParams {
  className?: string;
}

export function ChartBlock({ className, ...params }: ChartBlockProps) {
  const chartLayers = useChartLayersStore((state) => state.layers);
  const { spec, datafeedRef, chartReady, status, error, mainChartRef } =
    useChartBlockData(params);

  const { containerRef, containerHeight } = useChartBlockPane({
    panes: spec.panes,
    datafeedRef,
    chartReady,
    mainChartRef,
  });

  const legendTops = useMemo(
    () => computePaneTopOffsets(spec.panes, containerHeight),
    [containerHeight, spec.panes],
  );

  const mainPane = spec.panes.find((pane) => pane.role === "main");

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden p-6",
        className,
      )}
    >
      <div
        className={cn(
          "relative min-h-60 flex-1 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950",
          mainPane && mainPane.height !== "flex" && "shrink-0",
        )}
        style={
          mainPane && typeof mainPane.height === "number"
            ? { height: mainPane.height }
            : undefined
        }
      >
        <div
          ref={containerRef}
          className="absolute inset-0 touch-none"
          aria-label="Chart block"
        />

        {containerHeight > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-5">
            {spec.panes.map((pane) => {
              if (!paneHasLegendLayers(pane, chartLayers)) {
                return null;
              }

              const top = legendTops[pane.id];
              if (top === undefined) {
                return null;
              }

              return (
                <div
                  key={pane.id}
                  className="pointer-events-none absolute left-2"
                  style={{ top }}
                >
                  <PaneLegend pane={pane} />
                </div>
              );
            })}
          </div>
        ) : null}

        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80 text-zinc-400">
            Loading candles...
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-red-950/30 px-6 text-center text-red-400">
            <p>Failed to load candles — is your Axum backend running?</p>
            {error ? (
              <p className="max-w-md text-sm text-red-300/90">
                {error.message}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
