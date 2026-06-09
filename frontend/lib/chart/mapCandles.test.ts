import { describe, expect, it } from "vitest";
import type { Candle } from "@/lib/types";
import { CHART_COLORS } from "./theme";
import { toChartTime, toVolumeBar } from "./mapCandles";

function makeCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    timestamp: 1_700_000_000_000,
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 42,
    ...overrides,
  };
}

describe("toChartTime", () => {
  it("converts millisecond timestamps to chart seconds", () => {
    expect(toChartTime(1_700_000_000_000)).toBe(1_700_000_000);
  });
});

describe("toVolumeBar", () => {
  it("uses the up color when the candle closed higher", () => {
    const bar = toVolumeBar(makeCandle({ open: 100, close: 105 }));

    expect(bar.color).toBe(`${CHART_COLORS.up}80`);
  });

  it("uses the down color when the candle closed lower", () => {
    const bar = toVolumeBar(makeCandle({ open: 100, close: 95 }));

    expect(bar.color).toBe(`${CHART_COLORS.down}80`);
  });
});
