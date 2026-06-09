import { describe, expect, it } from "vitest";
import type { Candle } from "@/lib/types";
import { CandleCache } from "./cache";

function makeCandle(timestamp: number): Candle {
  return {
    timestamp,
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1,
  };
}

describe("CandleCache.merge", () => {
  it("sorts and deduplicates candles by timestamp", () => {
    const cache = new CandleCache();

    cache.set([makeCandle(2_000), makeCandle(1_000)]);
    cache.merge([makeCandle(1_000), makeCandle(3_000)]);

    expect(cache.getAll().map((candle) => candle.timestamp)).toEqual([
      1_000, 2_000, 3_000,
    ]);
    expect(cache.getCount()).toBe(3);
  });

  it("keeps the latest value for duplicate timestamps", () => {
    const cache = new CandleCache();

    cache.set([makeCandle(1_000)]);
    cache.merge([{ ...makeCandle(1_000), close: 200 }]);

    expect(cache.getAll()[0]?.close).toBe(200);
  });
});
