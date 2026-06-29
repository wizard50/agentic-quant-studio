import type { CandleDatafeed } from "@/lib/chart/datafeed";
import { INDICATOR_REGISTRY } from "./registry";
import type { IndicatorInstance } from "./types";

export interface IndicatorDataRange {
  startMs: number;
  endMs: number;
  limit: number;
}

function maxWarmupBars(instances: IndicatorInstance[]): number {
  let warmupBars = 0;

  for (const instance of instances) {
    if (!instance.visible) {
      continue;
    }

    const warmup = INDICATOR_REGISTRY[instance.kind]?.chartDefaults.warmup_bars ?? 0;
    warmupBars = Math.max(warmupBars, warmup);
  }

  return warmupBars;
}

function estimateBarDurationMs(
  oldest: number,
  newest: number,
  count: number,
): number {
  if (count <= 1) {
    return 60_000;
  }

  return Math.max(1, Math.floor((newest - oldest) / (count - 1)));
}

export function buildIndicatorDataRange(
  datafeed: CandleDatafeed,
  instances: IndicatorInstance[],
): IndicatorDataRange | null {
  const count = datafeed.getCandleCount();
  if (count === 0) {
    return null;
  }

  const oldest = datafeed.getOldestTimestamp();
  const newest = datafeed.getNewestTimestamp();
  if (oldest == null || newest == null) {
    return null;
  }

  const warmupBars = maxWarmupBars(instances);
  const barDurationMs = estimateBarDurationMs(oldest, newest, count);

  return {
    startMs: oldest - warmupBars * barDurationMs,
    endMs: newest,
    limit: count + warmupBars,
  };
}
