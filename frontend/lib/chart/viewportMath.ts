export function estimateBarDurationMs(
  oldest: number,
  newest: number,
  count: number,
): number {
  if (count <= 1) {
    return 60_000;
  }

  return Math.max(1, Math.floor((newest - oldest) / (count - 1)));
}
