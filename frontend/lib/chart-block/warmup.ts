import { filterIndicatorLayers, type ChartLayer } from "./layers";
import { lookupIndicatorDefinition } from "@/lib/indicators";

export function maxWarmupBarsFromLayers(layers: ChartLayer[]): number {
  let warmupBars = 0;

  for (const layer of filterIndicatorLayers(layers)) {
    if (!layer.visible) {
      continue;
    }

    const warmup =
      lookupIndicatorDefinition(layer.indicatorKind)?.chartDefaults
        .warmup_bars ?? 0;
    warmupBars = Math.max(warmupBars, warmup);
  }

  return warmupBars;
}
