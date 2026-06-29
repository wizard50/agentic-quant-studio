import type { IChartApi, LogicalRange } from "lightweight-charts";

function readLogicalRange(source: IChartApi): LogicalRange | null {
  return source.timeScale().getVisibleLogicalRange();
}

function applySharedTimeScaleOptions(
  source: IChartApi,
  target: IChartApi,
): void {
  const sourceOptions = source.timeScale().options();
  const targetOptions = target.timeScale().options();

  if (
    targetOptions.rightOffset === sourceOptions.rightOffset &&
    targetOptions.rightOffsetPixels === sourceOptions.rightOffsetPixels &&
    targetOptions.barSpacing === sourceOptions.barSpacing
  ) {
    return;
  }

  target.timeScale().applyOptions({
    rightOffset: sourceOptions.rightOffset,
    rightOffsetPixels: sourceOptions.rightOffsetPixels,
    barSpacing: sourceOptions.barSpacing,
  });
}

export function syncVisibleLogicalRangeBetween(
  source: IChartApi,
  target: IChartApi,
  logicalRange?: LogicalRange | null,
): boolean {
  if (source === target) {
    return false;
  }

  try {
    const range = logicalRange ?? readLogicalRange(source);
    if (!range) {
      return false;
    }

    target.timeScale().setVisibleLogicalRange(range);
    return true;
  } catch {
    return false;
  }
}

export function syncTimeScaleBetween(
  source: IChartApi,
  target: IChartApi,
): boolean {
  if (source === target) {
    return false;
  }

  try {
    applySharedTimeScaleOptions(source, target);

    const logicalRange = readLogicalRange(source);
    if (!logicalRange) {
      return false;
    }

    target.timeScale().setVisibleLogicalRange(logicalRange);
    return true;
  } catch {
    return false;
  }
}
