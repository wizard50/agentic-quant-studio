"use client";

import { useState } from "react";
import { LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIndicatorCatalog } from "@/hooks/useIndicatorCatalog";
import type { IndicatorCatalogEntry } from "@/lib/indicators/catalog";
import { defaultParamsFromCatalog } from "@/lib/indicators/instance";
import {
  getIndicatorDescription,
  getIndicatorName,
} from "@/lib/indicators/labels";
import { volumeDefinition, VOLUME_KIND } from "@/lib/indicators";
import { cn } from "@/lib/utils";
import { useChartLayersStore } from "@/stores/useChartLayersStore";

const catalogEntryClassName = cn(
  "w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors",
  "hover:border-zinc-700 hover:bg-zinc-800/80",
);

export function IndicatorBrowser() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useIndicatorCatalog();
  const addIndicator = useChartLayersStore((state) => state.addIndicator);

  const handleSelect = (entry: IndicatorCatalogEntry) => {
    addIndicator(entry.kind, defaultParamsFromCatalog(entry));
    setOpen(false);
  };

  const handleAddVolume = () => {
    addIndicator(VOLUME_KIND);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          title="Browse indicators"
          aria-label="Browse indicators"
        >
          Indicator
          <LineChart />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Indicators</DialogTitle>
          <DialogDescription>
            Select an indicator to add to the chart.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto">
          <ul className="flex flex-col gap-1">
            <li>
              <button
                type="button"
                onClick={handleAddVolume}
                className={catalogEntryClassName}
              >
                <div className="font-medium text-zinc-100">
                  {volumeDefinition.name}
                </div>
                {volumeDefinition.description ? (
                  <div className="mt-0.5 text-sm text-zinc-400">
                    {volumeDefinition.description}
                  </div>
                ) : null}
              </button>
            </li>

            {isLoading ? (
              <li className="py-8 text-center text-sm text-zinc-400">
                Loading indicators...
              </li>
            ) : error ? (
              <li className="py-8 text-center text-sm text-red-400">
                Failed to load indicator catalog — is your Axum backend running?
              </li>
            ) : data?.indicators.length === 0 ? (
              <li className="py-8 text-center text-sm text-zinc-400">
                No indicators available.
              </li>
            ) : (
              data?.indicators.map((entry) => {
                const description = getIndicatorDescription(entry.kind);

                return (
                  <li key={entry.kind}>
                    <button
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={catalogEntryClassName}
                    >
                      <div className="font-medium text-zinc-100">
                        {getIndicatorName(entry.kind)}
                      </div>
                      {description ? (
                        <div className="mt-0.5 text-sm text-zinc-400">
                          {description}
                        </div>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
