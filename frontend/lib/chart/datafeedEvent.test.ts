import { describe, expect, it, vi } from "vitest";
import type { Candle } from "@/lib/types";
import {
  handleBlockChartDatafeedEvent,
  hydrateBlockChart,
  syncBlockChartFromEvent,
} from "./datafeedEvent";
import type { BlockChartSeries, BlockLayerSeries } from "./types";

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

function makeBlockSeries() {
  const fitContent = vi.fn();
  const timeScale = {
    fitContent,
    getVisibleLogicalRange: vi.fn(() => null),
  };

  const candles = {
    setData: vi.fn(),
    seriesType: () => "Candlestick" as const,
  } as unknown as BlockLayerSeries;

  const volume = {
    setData: vi.fn(),
    seriesType: () => "Histogram" as const,
  } as unknown as BlockLayerSeries;

  const series: BlockChartSeries = {
    chart: {
      timeScale: () => timeScale,
    } as unknown as BlockChartSeries["chart"],
    byLayerId: new Map<string, BlockLayerSeries>([
      ["candles", candles],
      ["volume", volume],
    ]),
    candlesLayerId: "candles",
    histogramLayerIds: ["volume"],
  };

  return { series, fitContent, candles, volume };
}

describe("syncBlockChartFromEvent", () => {
  it("clears candles and histogram layers on reset", () => {
    const { series, candles, volume } = makeBlockSeries();

    syncBlockChartFromEvent(series, { type: "reset" });

    expect(candles.setData).toHaveBeenCalledWith([]);
    expect(volume.setData).toHaveBeenCalledWith([]);
  });

  it("sets candles and histogram layers on replace and prepend events", () => {
    const { series, candles, volume } = makeBlockSeries();
    const candlesData = [makeCandle(1_000), makeCandle(2_000)];

    syncBlockChartFromEvent(series, { type: "replace", candles: candlesData });
    syncBlockChartFromEvent(series, {
      type: "prepend",
      candles: candlesData,
      barsAdded: 1,
    });

    expect(candles.setData).toHaveBeenCalledTimes(2);
    expect(volume.setData).toHaveBeenCalledTimes(2);
  });
});

describe("hydrateBlockChart", () => {
  it("sets candles and histogram layers from cached candles", () => {
    const { series, candles, volume } = makeBlockSeries();
    const candlesData = [makeCandle(1_000), makeCandle(2_000)];

    hydrateBlockChart(series, candlesData);

    expect(candles.setData).toHaveBeenCalledOnce();
    expect(volume.setData).toHaveBeenCalledOnce();
  });
});

describe("handleBlockChartDatafeedEvent", () => {
  it("fits content on replace", () => {
    const { series, fitContent } = makeBlockSeries();
    const candlesData = [makeCandle(1_000)];

    handleBlockChartDatafeedEvent(
      { type: "replace", candles: candlesData },
      { chart: series.chart, series },
    );

    expect(fitContent).toHaveBeenCalledOnce();
  });
});
