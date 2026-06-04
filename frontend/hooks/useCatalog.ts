"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CatalogSnapshot,
  DatasetCoverage,
  CatalogSummary,
} from "@/lib/types";

/**
 * Canonical hook for the full candle catalog snapshot.
 * All other catalog-related hooks should be derived from this.
 */
export function useCatalog() {
  return useQuery<CatalogSnapshot>({
    queryKey: ["catalog", "candles"] as const,
    queryFn: async () => {
      const res = await fetch("/api/backend/v1/catalog/candles");
      if (!res.ok) {
        throw new Error(`Failed to load catalog: ${res.status}`);
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

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

/**
 * Returns just the list of datasets from the catalog.
 * Most convenient hook when you only need the rows for a table.
 */
export function useDatasets(): {
  datasets: DatasetCoverage[];
  isLoading: boolean;
  error: Error | null;
} {
  const { data: snapshot, isLoading, error } = useCatalog();

  return {
    datasets: snapshot?.datasets ?? [],
    isLoading,
    error: error ?? null,
  };
}
