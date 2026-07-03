import { volumeDefinition, VOLUME_KIND } from "./builtins";
import { definitionFromCatalogEntry } from "./buildFromCatalog";
import type { IndicatorCatalog } from "./catalog";
import type { IndicatorDefinition } from "./types";

const BUILTIN_DEFINITIONS: Record<string, IndicatorDefinition> = {
  [VOLUME_KIND]: volumeDefinition,
};

let registry: Record<string, IndicatorDefinition> = { ...BUILTIN_DEFINITIONS };

export function hydrateIndicatorRegistry(catalog: IndicatorCatalog): void {
  const catalogDefinitions = Object.fromEntries(
    catalog.indicators.map((entry) => [
      entry.kind,
      definitionFromCatalogEntry(entry),
    ]),
  );

  registry = {
    ...catalogDefinitions,
    ...BUILTIN_DEFINITIONS,
  };
}

export function resetIndicatorRegistry(): void {
  registry = { ...BUILTIN_DEFINITIONS };
}

export function lookupIndicatorDefinition(
  kind: string,
): IndicatorDefinition | undefined {
  return registry[kind];
}

export function getIndicatorRegistry(): Readonly<
  Record<string, IndicatorDefinition>
> {
  return registry;
}
