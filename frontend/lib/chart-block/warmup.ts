import type { GraphSpec } from "@/lib/studio/types";
import { lookupIndicatorDefinition } from "@/lib/indicators";
import { filterIndicatorLayers, type ChartLayer } from "./layers";

export function maxWarmupBarsFromLayers(layers: ChartLayer[]): number {
  let warmupBars = 0;

  for (const layer of filterIndicatorLayers(layers)) {
    if (!layer.visible) {
      continue;
    }

    const definition = lookupIndicatorDefinition(layer.indicatorKind);
    const catalogWarmup = definition?.chartDefaults?.warmup_bars ?? 0;
    const period =
      typeof layer.params.period === "number" ? layer.params.period : 0;
    warmupBars = Math.max(warmupBars, catalogWarmup, period);
  }

  return warmupBars;
}

/** Warmup padding for a study GraphSpec (indicator catalog defaults + period params). */
export function maxWarmupBarsFromGraph(graph: GraphSpec): number {
  let warmupBars = 0;

  for (const node of graph.nodes) {
    if (!node.kind.startsWith("indicator.")) {
      continue;
    }

    const definition = lookupIndicatorDefinition(node.kind);
    const catalogWarmup = definition?.chartDefaults?.warmup_bars ?? 0;
    const period =
      typeof node.params.period === "number" ? node.params.period : 0;
    warmupBars = Math.max(warmupBars, catalogWarmup, period);
  }

  return warmupBars;
}
