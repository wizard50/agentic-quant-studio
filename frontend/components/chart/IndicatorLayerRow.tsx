"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IndicatorSettingsDialog } from "@/components/chart/IndicatorSettingsDialog";
import type { IndicatorChartLayer } from "@/lib/chart-block";
import { isBuiltinIndicatorLayer } from "@/lib/indicators";
import {
  getIndicatorLayerColor,
  getIndicatorLayerLabel,
} from "@/lib/indicators/instance";
import { cn } from "@/lib/utils";
import { useChartLayersStore } from "@/stores/useChartLayersStore";

interface IndicatorLayerRowProps {
  layer: IndicatorChartLayer;
}

export function IndicatorLayerRow({ layer }: IndicatorLayerRowProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setVisible = useChartLayersStore((state) => state.setVisible);
  const removeLayer = useChartLayersStore((state) => state.removeLayer);
  const status = useChartLayersStore(
    (state) => state.layerStatusById[layer.id],
  );

  const loading = status?.loading ?? false;
  const error = status?.error ?? null;
  const color = getIndicatorLayerColor(layer);
  const builtin = isBuiltinIndicatorLayer(layer);

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1 rounded px-1 py-0.5",
          !layer.visible && "opacity-50",
          error && "text-red-400",
        )}
        title={error ?? undefined}
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />

        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-100">
          {getIndicatorLayerLabel(layer)}
        </span>

        {loading ? (
          <Loader2 className="size-3 shrink-0 animate-spin text-zinc-400" />
        ) : null}

        <div className="flex shrink-0 items-center gap-px">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={layer.visible ? "Hide indicator" : "Show indicator"}
            title={layer.visible ? "Hide" : "Show"}
            onClick={() => setVisible(layer.id, !layer.visible)}
          >
            {layer.visible ? <Eye /> : <EyeOff />}
          </Button>

          {!builtin ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Edit indicator"
              title="Edit"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings />
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Remove indicator"
            title="Remove"
            onClick={() => removeLayer(layer.id)}
          >
            <X />
          </Button>
        </div>
      </div>

      {settingsOpen ? (
        <IndicatorSettingsDialog
          layer={layer}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
}
