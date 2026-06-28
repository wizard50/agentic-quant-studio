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
import {
  getIndicatorDescription,
  getIndicatorName,
} from "@/lib/indicators/labels";
import { cn } from "@/lib/utils";

export function IndicatorBrowser() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useIndicatorCatalog();

  const handleSelect = (entry: IndicatorCatalogEntry) => {
    console.log("Selected indicator:", entry);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title="Browse indicators"
          aria-label="Browse indicators"
        >
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
          {isLoading ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              Loading indicators...
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-400">
              Failed to load indicator catalog — is your Axum backend running?
            </p>
          ) : data?.indicators.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              No indicators available.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data?.indicators.map((entry) => {
                const description = getIndicatorDescription(entry.kind);

                return (
                  <li key={entry.kind}>
                    <button
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={cn(
                        "w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors",
                        "hover:border-zinc-700 hover:bg-zinc-800/80",
                      )}
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
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
