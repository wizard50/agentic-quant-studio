import { lookupIndicatorDefinition } from "./registry";

function fallbackName(kind: string): string {
  const slug = kind.split(".").pop() ?? kind;
  return slug.toUpperCase();
}

export function getIndicatorName(kind: string): string {
  return lookupIndicatorDefinition(kind)?.name ?? fallbackName(kind);
}

export function getIndicatorDescription(kind: string): string | undefined {
  return lookupIndicatorDefinition(kind)?.description;
}

export function getIndicatorLabel(kind: string): string {
  const definition = lookupIndicatorDefinition(kind);
  if (definition) {
    return definition.label(definition.defaultParams);
  }

  return fallbackName(kind);
}
