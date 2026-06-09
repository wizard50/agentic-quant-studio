import type { IChartApi, LogicalRange } from "lightweight-charts";

export const HISTORY_PRELOAD_THRESHOLD = 50;
export const LOAD_OLDER_DEBOUNCE_MS = 150;

export function shouldLoadOlderHistory(
  barsBefore: number | null | undefined,
  threshold: number = HISTORY_PRELOAD_THRESHOLD,
): boolean {
  if (barsBefore == null) {
    return false;
  }

  return barsBefore < threshold;
}

export function preserveViewportOnPrepend(
  chart: IChartApi,
  barsAdded: number,
  rangeBeforeUpdate: LogicalRange | null,
): void {
  if (barsAdded <= 0 || !rangeBeforeUpdate) {
    return;
  }

  chart.timeScale().setVisibleLogicalRange({
    from: rangeBeforeUpdate.from + barsAdded,
    to: rangeBeforeUpdate.to + barsAdded,
  });
}
