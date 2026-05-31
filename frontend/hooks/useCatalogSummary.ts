"use client";

import { useCatalog } from "./useCatalog";
import type { CatalogSummary } from "@/lib/types";

/**
 * Returns derived KPI stats from the catalog.
 * Built on top of the canonical useCatalog hook.
 */
export function useCatalogSummary() {
  const { data: snapshot, isLoading, error } = useCatalog();

  const datasets = snapshot?.datasets ?? [];

  const summary: CatalogSummary = {
    totalDatasets: datasets.length,
    totalCandles: datasets.reduce((sum, d) => sum + (d.record_count ?? 0), 0),
    storageBytes: datasets.reduce(
      (sum, d) => sum + (d.approx_size_bytes ?? 0),
      0,
    ),
    lastUpdated: snapshot?.generated_at ?? null,
  };

  return {
    data: snapshot ? summary : undefined,
    isLoading,
    error,
  };
}
