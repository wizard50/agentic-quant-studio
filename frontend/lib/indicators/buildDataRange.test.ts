import { describe, expect, it } from "vitest";
import { CandleDatafeed } from "@/lib/chart/datafeed";
import { buildIndicatorDataRange } from "./buildDataRange";
import { RSI_KIND } from "./registry";
import type { IndicatorInstance } from "./types";

function seedDatafeed(timestamps: number[]): CandleDatafeed {
  const datafeed = new CandleDatafeed(async () =>
    timestamps.map((timestamp) => ({
      timestamp,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 10,
    })),
  );

  datafeed.reset({
    exchange: "bybit",
    category: "spot",
    symbol: "BTCUSDT",
    interval: "1d",
  });

  return datafeed;
}

const rsiInstance: IndicatorInstance = {
  id: "rsi-1",
  kind: RSI_KIND,
  params: { period: 14 },
  visible: true,
  color: "#22c55e",
};

describe("buildIndicatorDataRange", () => {
  it("returns null when the datafeed has no candles", () => {
    const datafeed = seedDatafeed([]);

    expect(buildIndicatorDataRange(datafeed, [rsiInstance])).toBeNull();
  });

  it("anchors indicator queries to the loaded candle cache", async () => {
    const datafeed = seedDatafeed([1_000, 2_000, 3_000, 4_000, 5_000]);
    await datafeed.loadInitial(5);

    expect(buildIndicatorDataRange(datafeed, [rsiInstance])).toEqual({
      startMs: 1_000 - 14 * 1_000,
      endMs: 5_000,
      limit: 19,
    });
  });
});
