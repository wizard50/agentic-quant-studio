import { describe, expect, it, vi } from "vitest";
import type { Candle } from "@/lib/types";
import { handleDatafeedEvent, syncSeriesFromEvent } from "./datafeedEvent";
import type { ChartSeries } from "./types";

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

function makeSeries(): ChartSeries {
  return {
    chart: {} as ChartSeries["chart"],
    candles: { setData: vi.fn() } as unknown as ChartSeries["candles"],
    volume: { setData: vi.fn() } as unknown as ChartSeries["volume"],
  };
}

describe("syncSeriesFromEvent", () => {
  it("clears both series on reset", () => {
    const series = makeSeries();

    syncSeriesFromEvent(series, { type: "reset" });

    expect(series.candles.setData).toHaveBeenCalledWith([]);
    expect(series.volume.setData).toHaveBeenCalledWith([]);
  });

  it("sets both series on replace and prepend events", () => {
    const series = makeSeries();
    const candles = [makeCandle(1_000), makeCandle(2_000)];

    syncSeriesFromEvent(series, { type: "replace", candles });
    syncSeriesFromEvent(series, {
      type: "prepend",
      candles,
      barsAdded: 1,
    });

    expect(series.candles.setData).toHaveBeenCalledTimes(2);
    expect(series.volume.setData).toHaveBeenCalledTimes(2);
  });
});

describe("handleDatafeedEvent", () => {
  it("calls onLoading for loading events", () => {
    const onLoading = vi.fn();

    handleDatafeedEvent(
      { type: "loading" },
      { chart: null, series: null },
      { onLoading },
    );

    expect(onLoading).toHaveBeenCalledOnce();
  });

  it("ignores paging lifecycle events", () => {
    const onLoading = vi.fn();

    expect(() => {
      handleDatafeedEvent(
        { type: "paging", direction: "older", loading: true },
        { chart: null, series: null },
        { onLoading },
      );
      handleDatafeedEvent(
        { type: "pageError", direction: "older", error: new Error("fail") },
        { chart: null, series: null },
        { onLoading },
      );
      handleDatafeedEvent(
        { type: "rangeBoundary", edge: "start" },
        { chart: null, series: null },
        { onLoading },
      );
    }).not.toThrow();

    expect(onLoading).not.toHaveBeenCalled();
  });
});
