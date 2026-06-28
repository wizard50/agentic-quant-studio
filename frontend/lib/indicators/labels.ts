import { INDICATOR_REGISTRY } from "./registry";

function fallbackName(kind: string): string {
  const slug = kind.split(".").pop() ?? kind;
  return slug.toUpperCase();
}

export function getIndicatorName(kind: string): string {
  return INDICATOR_REGISTRY[kind]?.name ?? fallbackName(kind);
}

export function getIndicatorDescription(kind: string): string | undefined {
  return INDICATOR_REGISTRY[kind]?.description;
}

export function getIndicatorLabel(kind: string): string {
  const definition = INDICATOR_REGISTRY[kind];
  if (definition) {
    return definition.label(definition.defaultParams);
  }

  return fallbackName(kind);
}
