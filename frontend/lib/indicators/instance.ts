import type { IndicatorChartLayer } from "@/lib/chart-block";
import type { IndicatorCatalogEntry } from "./catalog";
import type { IndicatorDefinition, IndicatorParams } from "./types";
import { lookupIndicatorDefinition } from "./registry";

export function getIndicatorDefinition(
  layer: IndicatorChartLayer,
): IndicatorDefinition | undefined {
  return lookupIndicatorDefinition(layer.indicatorKind);
}

let instanceIdCounter = 0;

/** Graph node ids must not contain '.' — port refs use `node_id.port_name`. */
export function createInstanceId(kind: string): string {
  instanceIdCounter += 1;
  return `${kind.replace(/\./g, "-")}-${Date.now()}-${instanceIdCounter}`;
}

export function getIndicatorLayerLabel(layer: IndicatorChartLayer): string {
  const definition = getIndicatorDefinition(layer);
  return definition ? definition.label(layer.params) : layer.indicatorKind;
}

export function getIndicatorLayerColor(layer: IndicatorChartLayer): string {
  return layer.color;
}

export function defaultParamsFromCatalog(
  entry: IndicatorCatalogEntry,
): IndicatorParams {
  const params: IndicatorParams = {};

  for (const param of entry.params) {
    const value = param.default;
    if (typeof value === "string" || typeof value === "number") {
      params[param.name] = value;
    }
  }

  return params;
}
