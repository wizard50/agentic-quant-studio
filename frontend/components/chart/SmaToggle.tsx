"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEMP_SMA_INSTANCE_ID } from "@/lib/indicators";
import { cn } from "@/lib/utils";
import { useChartIndicatorsStore } from "@/stores/useChartIndicatorsStore";

export function SmaToggle() {
  const isActive = useChartIndicatorsStore((state) => state.isTempSmaActive());
  const toggleTempSma = useChartIndicatorsStore((state) => state.toggleTempSma);
  const runtime = useChartIndicatorsStore(
    (state) => state.runtime[TEMP_SMA_INSTANCE_ID],
  );

  const loading = runtime?.loading ?? false;
  const error = runtime?.error ?? null;

  return (
    <Button
      type="button"
      size="sm"
      variant={isActive ? "default" : "outline"}
      aria-pressed={isActive}
      disabled={loading}
      onClick={toggleTempSma}
      className={cn(
        "min-w-24",
        error && isActive && "border-destructive text-destructive",
      )}
      title={error ?? undefined}
    >
      {loading ? <Loader2 className="animate-spin" /> : null}
      SMA 20
    </Button>
  );
}
