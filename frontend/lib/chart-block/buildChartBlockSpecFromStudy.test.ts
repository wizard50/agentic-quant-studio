import { describe, expect, it } from "vitest";
import type { GraphSpec } from "@/lib/studio/types";
import { buildChartBlockSpecFromStudy } from "./buildChartBlockSpecFromStudy";
import type { PresentationSpec } from "./types";
import { MAIN_PANE_ID } from "./constants";
import { MARKET_LAYER_ID } from "./layers";

const GOLDEN_CROSS: GraphSpec = {
  id: "golden-cross-btc-1d",
  version: 1,
  kind: "chart",
  nodes: [
    {
      id: "candles_src",
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
    { id: "cross", kind: "logic.crossover", params: {} },
  ],
  edges: [
    { from: "candles_src.close", to: "sma20.input" },
    { from: "candles_src.close", to: "sma50.input" },
    { from: "sma20.value", to: "cross.fast" },
    { from: "sma50.value", to: "cross.slow" },
  ],
};

const GOLDEN_CROSS_PRESENTATION: PresentationSpec = {
  version: 1,
  panes: [
    {
      id: MAIN_PANE_ID,
      role: "main",
      height: "flex",
      layers: [
        {
          id: MARKET_LAYER_ID,
          visual: "candlestick",
          ports: {
            time: "candles_src.timestamp",
            open: "candles_src.open",
            high: "candles_src.high",
            low: "candles_src.low",
            close: "candles_src.close",
          },
          visible: true,
        },
        {
          id: "sma20",
          visual: "line",
          ports: {
            time: "candles_src.timestamp",
            value: "sma20.value",
          },
          style: { color: "#f59e0b", lineWidth: 2 },
          visible: true,
        },
        {
          id: "sma50",
          visual: "line",
          ports: {
            time: "candles_src.timestamp",
            value: "sma50.value",
          },
          style: { color: "#3b82f6", lineWidth: 2 },
          visible: true,
        },
        {
          id: "cross",
          visual: "markers",
          ports: {
            time: "candles_src.timestamp",
            signal: "cross.signal",
          },
          style: { color: "#22c55e", markerShape: "arrowUp" },
          visible: true,
        },
      ],
    },
  ],
  outputs: [
    "candles_src.close",
    "candles_src.high",
    "candles_src.low",
    "candles_src.open",
    "candles_src.timestamp",
    "cross.signal",
    "sma20.value",
    "sma50.value",
  ],
};

describe("buildChartBlockSpecFromStudy", () => {
  it("pairs graph with backend presentation without recompiling", () => {
    const spec = buildChartBlockSpecFromStudy(
      GOLDEN_CROSS,
      GOLDEN_CROSS_PRESENTATION,
    );

    expect(spec.version).toBe(1);
    expect(spec.panes).toBe(GOLDEN_CROSS_PRESENTATION.panes);
    expect(spec.data.graph).toBe(GOLDEN_CROSS);
    expect(spec.data.outputs).toBe(GOLDEN_CROSS_PRESENTATION.outputs);
    expect(spec.panes[0]?.layers.map((l) => l.id)).toEqual([
      MARKET_LAYER_ID,
      "sma20",
      "sma50",
      "cross",
    ]);
    expect(spec.data.outputs).toContain("cross.signal");
  });

  it("uses study id as block id when provided", () => {
    const spec = buildChartBlockSpecFromStudy(
      GOLDEN_CROSS,
      GOLDEN_CROSS_PRESENTATION,
      "study-abc",
    );
    expect(spec.id).toBe("study-abc");
  });
});
