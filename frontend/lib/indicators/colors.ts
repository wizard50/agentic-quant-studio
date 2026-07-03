import type { IndicatorChartLayer } from "@/lib/chart-block";

/** Ten hues spaced for legibility on the dark chart background. */
export const INDICATOR_COLOR_POOL = [
  "#f59e0b",
  "#3b82f6",
  "#22c55e",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
  "#f97316",
  "#eab308",
  "#14b8a6",
  "#f43f5e",
] as const;

export function pickIndicatorColor(
  existingLayers: IndicatorChartLayer[],
): string {
  const used = new Set(existingLayers.map((layer) => layer.color));

  for (const color of INDICATOR_COLOR_POOL) {
    if (!used.has(color)) {
      return color;
    }
  }

  return INDICATOR_COLOR_POOL[
    existingLayers.length % INDICATOR_COLOR_POOL.length
  ]!;
}
