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
import { INDICATOR_REGISTRY } from "@/lib/indicators";
import type { IndicatorInstance, IndicatorParams } from "@/lib/indicators";
import { getIndicatorName } from "@/lib/indicators/labels";
import { useChartIndicatorsStore } from "@/stores/useChartIndicatorsStore";

interface IndicatorSettingsDialogProps {
  instance: IndicatorInstance;
  onClose: () => void;
}

export function IndicatorSettingsDialog({
  instance,
  onClose,
}: IndicatorSettingsDialogProps) {
  const updateParams = useChartIndicatorsStore((state) => state.updateParams);
  const definition = INDICATOR_REGISTRY[instance.kind];
  const [values, setValues] = useState<IndicatorParams>(instance.params);
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
    const nextParams: IndicatorParams = { ...instance.params };

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

    updateParams(instance.id, nextParams);
    onClose();
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{getIndicatorName(instance.kind)} settings</DialogTitle>
          <DialogDescription>
            Adjust parameters for this indicator instance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {definition.configSchema.map((field) => {
            const value = values[field.name];

            return (
              <div key={field.name} className="flex flex-col gap-2">
                <Label htmlFor={`${instance.id}-${field.name}`}>
                  {field.label ?? field.name}
                </Label>
                <Input
                  id={`${instance.id}-${field.name}`}
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
