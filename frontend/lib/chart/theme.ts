export const CHART_COLORS = {
  background: "#09090b",
  text: "#a1a1aa",
  grid: "#27272a",
  up: "#22c55e",
  down: "#ef4444",
  volume: "#3b82f6",
} as const;

export function volumeBarColor(isUp: boolean): string {
  return isUp ? `${CHART_COLORS.up}80` : `${CHART_COLORS.down}80`;
}
