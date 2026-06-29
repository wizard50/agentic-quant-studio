export type CatalogType = "integer" | "number" | "string" | "boolean";

export type ChartRole = "overlay" | "oscillator";

export interface ValueRange {
  min: number;
  max: number;
}

export interface ChartDefaults {
  role: ChartRole;
  value_range?: ValueRange;
  warmup_bars?: number;
}

export interface CatalogPort {
  name: string;
  type: CatalogType;
  series: boolean;
}

export interface CatalogParam {
  name: string;
  type: CatalogType;
  default?: number | string | boolean;
  min?: number;
  max?: number;
}

export interface IndicatorCatalogEntry {
  kind: string;
  inputs: CatalogPort[];
  outputs: CatalogPort[];
  params: CatalogParam[];
  chart_defaults?: ChartDefaults;
}

export interface IndicatorCatalog {
  indicators: IndicatorCatalogEntry[];
}

const INDICATOR_CATALOG_URL = "/api/backend/v1/catalog/indicators";

export async function fetchIndicatorCatalog(): Promise<IndicatorCatalog> {
  const res = await fetch(INDICATOR_CATALOG_URL);

  if (!res.ok) {
    throw new Error(`Failed to load indicator catalog: ${res.status}`);
  }

  return res.json() as Promise<IndicatorCatalog>;
}
