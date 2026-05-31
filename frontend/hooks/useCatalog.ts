"use client";

import { useQuery } from "@tanstack/react-query";
import type { CatalogSnapshot, DatasetCoverage } from "@/lib/types";

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
