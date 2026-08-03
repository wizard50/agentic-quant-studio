import { describe, expect, it } from "vitest";
import type { GraphSpec } from "@/lib/studio/types";
import { maxWarmupBarsFromGraph, maxWarmupBarsFromLayers } from "./warmup";
import type { ChartLayer } from "./layers";

describe("maxWarmupBarsFromGraph", () => {
  it("uses the max indicator period from the graph", () => {
    const graph: GraphSpec = {
      id: "g",
      version: 1,
      kind: "chart",
      nodes: [
        {
          id: "ds1",
          kind: "datasource.candles",
          params: {
            exchange: "bybit",
            category: "spot",
            symbol: "BTCUSDT",
            interval: "1d",
          },
        },
        { id: "sma20", kind: "indicator.sma", params: { period: 20 } },
        { id: "sma50", kind: "indicator.sma", params: { period: 50 } },
      ],
      edges: [],
    };

    expect(maxWarmupBarsFromGraph(graph)).toBe(50);
  });

  it("returns 0 when there are no indicators", () => {
    const graph: GraphSpec = {
      id: "g",
      version: 1,
      kind: "chart",
      nodes: [
        {
          id: "ds1",
          kind: "datasource.candles",
          params: {
            exchange: "bybit",
            category: "spot",
            symbol: "BTCUSDT",
            interval: "1d",
          },
        },
      ],
      edges: [],
    };

    expect(maxWarmupBarsFromGraph(graph)).toBe(0);
  });
});

describe("maxWarmupBarsFromLayers", () => {
  it("uses instance period when larger than catalog default", () => {
    const layers: ChartLayer[] = [
      {
        id: "candles",
        kind: "market",
        visible: true,
        seriesStyle: "candlestick",
      },
      {
        id: "sma-50",
        kind: "indicator",
        visible: true,
        indicatorKind: "indicator.sma",
        params: { period: 50 },
        color: "#f59e0b",
      },
    ];

    expect(maxWarmupBarsFromLayers(layers)).toBe(50);
  });
});
