"use client";

import { useQuery } from "@tanstack/react-query";
import type { CatalogSnapshot, CatalogSummary } from "@/lib/types";

/**
 * Fetches the warehouse catalog snapshot and returns derived KPI stats.
 * Uses React Query as the single source of truth for server state.
 */
export function useCatalogSummary() {
  return useQuery<CatalogSnapshot, Error, CatalogSummary>({
    queryKey: ["catalog", "candles"] as const,
    queryFn: async () => {
      const res = await fetch("/api/backend/v1/catalog/candles");
      if (!res.ok) {
        throw new Error(`Failed to load catalog: ${res.status}`);
      }
      return res.json();
    },
    select: (snapshot): CatalogSummary => {
      const datasets = snapshot?.datasets ?? [];
      const totalDatasets = datasets.length;
      const totalCandles = datasets.reduce(
        (sum, d) => sum + (d.record_count ?? 0),
        0,
      );
      const storageBytes = datasets.reduce(
        (sum, d) => sum + (d.approx_size_bytes ?? 0),
        0,
      );

      return {
        totalDatasets,
        totalCandles,
        storageBytes,
        lastUpdated: snapshot?.generated_at ?? null,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes — catalog scans are expensive
    refetchOnWindowFocus: false,
  });
}
