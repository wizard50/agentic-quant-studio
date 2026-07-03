"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IndicatorChartLayer } from "@/lib/chart-block";
import { lookupIndicatorDefinition } from "@/lib/indicators";
import type { IndicatorParams } from "@/lib/indicators";
import { getIndicatorName } from "@/lib/indicators/labels";
import { useChartLayersStore } from "@/stores/useChartLayersStore";

interface IndicatorSettingsDialogProps {
  layer: IndicatorChartLayer;
  onClose: () => void;
}

export function IndicatorSettingsDialog({
  layer,
  onClose,
}: IndicatorSettingsDialogProps) {
  const updateIndicatorParams = useChartLayersStore(
    (state) => state.updateIndicatorParams,
  );
  const definition = lookupIndicatorDefinition(layer.indicatorKind);
  const [values, setValues] = useState<IndicatorParams>(layer.params);
  const [error, setError] = useState<string | null>(null);

  if (!definition) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };

  const handleSave = () => {
    const nextParams: IndicatorParams = { ...layer.params };

    for (const field of definition.configSchema) {
      const raw = values[field.name];

      if (field.type === "number") {
        const numeric =
          typeof raw === "number" ? raw : Number.parseFloat(String(raw));

        if (!Number.isFinite(numeric)) {
          setError(`${field.label ?? field.name} must be a number`);
          return;
        }

        if (field.min != null && numeric < field.min) {
          setError(
            `${field.label ?? field.name} must be at least ${field.min}`,
          );
          return;
        }

        if (field.max != null && numeric > field.max) {
          setError(`${field.label ?? field.name} must be at most ${field.max}`);
          return;
        }

        nextParams[field.name] = numeric;
      } else if (typeof raw === "string") {
        nextParams[field.name] = raw;
      }
    }

    updateIndicatorParams(layer.id, nextParams);
    onClose();
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {getIndicatorName(layer.indicatorKind)} settings
          </DialogTitle>
          <DialogDescription>
            Adjust parameters for this indicator layer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {definition.configSchema.map((field) => {
            const value = values[field.name];

            return (
              <div key={field.name} className="flex flex-col gap-2">
                <Label htmlFor={`${layer.id}-${field.name}`}>
                  {field.label ?? field.name}
                </Label>
                <Input
                  id={`${layer.id}-${field.name}`}
                  type={field.type === "number" ? "number" : "text"}
                  min={field.min}
                  max={field.max}
                  value={value ?? ""}
                  onChange={(event) => {
                    const nextValue =
                      field.type === "number"
                        ? event.target.value === ""
                          ? ""
                          : Number(event.target.value)
                        : event.target.value;

                    setValues((current) => ({
                      ...current,
                      [field.name]: nextValue,
                    }));
                    setError(null);
                  }}
                />
              </div>
            );
          })}

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
