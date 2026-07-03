"use client";

import { useEffect } from "react";
import { useIndicatorCatalog } from "@/hooks/useIndicatorCatalog";
import { hydrateIndicatorRegistry } from "@/lib/indicators/registry";

export function IndicatorRegistryHydrator() {
  const { data } = useIndicatorCatalog();

  useEffect(() => {
    if (data) {
      hydrateIndicatorRegistry(data);
    }
  }, [data]);

  return null;
}
