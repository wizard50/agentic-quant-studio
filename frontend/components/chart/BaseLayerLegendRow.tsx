"use client";

import type { CSSProperties } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHART_COLORS } from "@/lib/chart";
import {
  getLayerDefaultVisible,
  getLayerLegendLabel,
  type LayerSpec,
} from "@/lib/chart-block";
import { cn } from "@/lib/utils";
import { useChartLayersStore } from "@/stores/useChartLayersStore";

interface BaseLayerLegendRowProps {
  layer: LayerSpec;
}

function layerSwatchStyle(layer: LayerSpec): CSSProperties {
  if (layer.visual === "candlestick" || layer.visual === "bar") {
    return {
      background: `linear-gradient(90deg, ${CHART_COLORS.up} 50%, ${CHART_COLORS.down} 50%)`,
    };
  }

  return { backgroundColor: CHART_COLORS.volume };
}

export function BaseLayerLegendRow({ layer }: BaseLayerLegendRowProps) {
  const setVisible = useChartLayersStore((state) => state.setVisible);
  const chartLayer = useChartLayersStore((state) =>
    state.layers.find((item) => item.id === layer.id),
  );
  const visible = chartLayer?.visible ?? getLayerDefaultVisible(layer);

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded px-1 py-0.5",
        !visible && "opacity-50",
      )}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={layerSwatchStyle(layer)}
        aria-hidden
      />

      <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-100">
        {getLayerLegendLabel(layer)}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={visible ? "Hide layer" : "Show layer"}
        title={visible ? "Hide" : "Show"}
        onClick={() => setVisible(layer.id, !visible)}
      >
        {visible ? <Eye /> : <EyeOff />}
      </Button>
    </div>
  );
}
