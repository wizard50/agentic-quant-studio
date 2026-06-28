import type { IndicatorCatalogEntry } from "./catalog";
import type { IndicatorInstance, IndicatorParams } from "./types";
import { INDICATOR_REGISTRY } from "./registry";

let instanceIdCounter = 0;

/** Graph node ids must not contain '.' — port refs use `node_id.port_name`. */
export function createInstanceId(kind: string): string {
  instanceIdCounter += 1;
  return `${kind.replace(/\./g, "-")}-${Date.now()}-${instanceIdCounter}`;
}

export function getInstanceLabel(instance: IndicatorInstance): string {
  const definition = INDICATOR_REGISTRY[instance.kind];
  if (definition) {
    return definition.label(instance.params);
  }

  return instance.kind;
}

export function getInstanceColor(instance: IndicatorInstance): string {
  return instance.color;
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
