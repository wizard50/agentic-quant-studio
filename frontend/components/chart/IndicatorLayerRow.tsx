"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IndicatorSettingsDialog } from "@/components/chart/IndicatorSettingsDialog";
import { getInstanceColor, getInstanceLabel } from "@/lib/indicators/instance";
import type { IndicatorInstance } from "@/lib/indicators";
import { cn } from "@/lib/utils";
import { useChartIndicatorsStore } from "@/stores/useChartIndicatorsStore";

interface IndicatorLayerRowProps {
  instance: IndicatorInstance;
}

export function IndicatorLayerRow({ instance }: IndicatorLayerRowProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setVisible = useChartIndicatorsStore((state) => state.setVisible);
  const removeInstance = useChartIndicatorsStore(
    (state) => state.removeInstance,
  );
  const runtime = useChartIndicatorsStore(
    (state) => state.runtime[instance.id],
  );

  const loading = runtime?.loading ?? false;
  const error = runtime?.error ?? null;
  const color = getInstanceColor(instance);

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-1.5 py-1",
          !instance.visible && "opacity-50",
          error && "text-red-400",
        )}
        title={error ?? undefined}
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
          {getInstanceLabel(instance)}
        </span>

        {loading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-zinc-400" />
        ) : null}

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={instance.visible ? "Hide indicator" : "Show indicator"}
            title={instance.visible ? "Hide" : "Show"}
            onClick={() => setVisible(instance.id, !instance.visible)}
          >
            {instance.visible ? <Eye /> : <EyeOff />}
          </Button>

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

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Remove indicator"
            title="Remove"
            onClick={() => removeInstance(instance.id)}
          >
            <X />
          </Button>
        </div>
      </div>

      {settingsOpen ? (
        <IndicatorSettingsDialog
          instance={instance}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
}
