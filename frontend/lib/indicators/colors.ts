import type { IndicatorInstance } from "./types";

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
  existingInstances: IndicatorInstance[],
): string {
  const used = new Set(existingInstances.map((instance) => instance.color));

  for (const color of INDICATOR_COLOR_POOL) {
    if (!used.has(color)) {
      return color;
    }
  }

  return INDICATOR_COLOR_POOL[
    existingInstances.length % INDICATOR_COLOR_POOL.length
  ]!;
}
