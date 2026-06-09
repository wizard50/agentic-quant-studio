import { describe, expect, it, vi } from "vitest";
import type { Candle } from "@/lib/types";
import { CandleDatafeed } from "./datafeed";
import type { CandleQuery, FetchCandlesFn, SeriesKey } from "./types";

const key: SeriesKey = {
  exchange: "bybit",
  category: "spot",
  symbol: "BTCUSDT",
  interval: "1m",
};

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

function makeSequentialCandles(start: number, count: number, stepMs = 60_000) {
  return Array.from({ length: count }, (_, index) =>
    makeCandle(start + index * stepMs),
  );
}

describe("CandleDatafeed.loadOlder", () => {
  it("fetches candles strictly before the oldest cached timestamp", async () => {
    const fetchMock = vi
      .fn<FetchCandlesFn>()
      .mockResolvedValueOnce(makeSequentialCandles(1_000, 500))
      .mockImplementationOnce(async (_key, query: CandleQuery) => {
        expect(query.end).toEqual(new Date(1_000 - 1));
        expect(query.limit).toBe(500);
        return makeSequentialCandles(0, 500);
      });

    const datafeed = new CandleDatafeed(fetchMock);
    const events: string[] = [];

    datafeed.subscribe((event) => {
      events.push(event.type);
    });

    datafeed.reset(key);
    await datafeed.loadInitial(500);
    await datafeed.loadOlder();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events).toContain("prepend");
    expect(datafeed.getCandleCount()).toBe(1_000);
    expect(datafeed.getHasMoreHistory()).toBe(true);
  });

  it("emits start range boundary when the older page is empty", async () => {
    const fetchMock = vi
      .fn<FetchCandlesFn>()
      .mockResolvedValueOnce(makeSequentialCandles(1_000, 10))
      .mockResolvedValueOnce([]);

    const datafeed = new CandleDatafeed(fetchMock);
    const events: string[] = [];

    datafeed.subscribe((event) => {
      events.push(event.type);
    });

    datafeed.reset(key);
    await datafeed.loadInitial(500);
    await datafeed.loadOlder();

    expect(datafeed.getHasMoreHistory()).toBe(false);
    expect(events).toContain("rangeBoundary");
    expect(events).not.toContain("prepend");
  });

  it("ignores stale loadOlder results after reset", async () => {
    let resolveOlder: (candles: Candle[]) => void = () => {};
    const olderPromise = new Promise<Candle[]>((resolve) => {
      resolveOlder = resolve;
    });

    const fetchMock = vi
      .fn<FetchCandlesFn>()
      .mockResolvedValueOnce(makeSequentialCandles(1_000, 10))
      .mockImplementationOnce(() => olderPromise);

    const datafeed = new CandleDatafeed(fetchMock);

    datafeed.reset(key);
    await datafeed.loadInitial(500);

    const olderLoad = datafeed.loadOlder();
    datafeed.reset({ ...key, symbol: "ETHUSDT" });

    resolveOlder(makeSequentialCandles(0, 100));
    await olderLoad;

    expect(datafeed.getCandleCount()).toBe(0);
  });

  it("emits pageError when the older fetch fails", async () => {
    const fetchMock = vi
      .fn<FetchCandlesFn>()
      .mockResolvedValueOnce(makeSequentialCandles(1_000, 500))
      .mockRejectedValueOnce(new Error("network down"));

    const datafeed = new CandleDatafeed(fetchMock);
    const events: string[] = [];

    datafeed.subscribe((event) => {
      events.push(event.type);
    });

    datafeed.reset(key);
    await datafeed.loadInitial(500);
    await datafeed.loadOlder();

    expect(events).toContain("pageError");
    expect(events).toContain("paging");
    expect(datafeed.isLoadingMore()).toBe(false);
    expect(datafeed.getCandleCount()).toBe(500);
  });
});
