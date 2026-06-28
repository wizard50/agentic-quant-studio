"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchIndicatorCatalog,
  type IndicatorCatalog,
} from "@/lib/indicators/catalog";

export function useIndicatorCatalog() {
  return useQuery<IndicatorCatalog>({
    queryKey: ["catalog", "indicators"] as const,
    queryFn: fetchIndicatorCatalog,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
