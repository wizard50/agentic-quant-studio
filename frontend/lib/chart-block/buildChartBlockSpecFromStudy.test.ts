import { describe, expect, it } from "vitest";
import type { GraphSpec } from "@/lib/studio/types";
import { buildChartBlockSpecFromStudy } from "./buildChartBlockSpecFromStudy";
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

describe("buildChartBlockSpecFromStudy", () => {
  it("builds main pane with candles and indicator lines; skips logic", () => {
    const spec = buildChartBlockSpecFromStudy(GOLDEN_CROSS);

    expect(spec.panes).toHaveLength(1);
    expect(spec.panes[0]?.id).toBe(MAIN_PANE_ID);
    expect(spec.panes[0]?.layers.map((layer) => layer.id)).toEqual([
      MARKET_LAYER_ID,
      "sma20",
      "sma50",
    ]);

    const candles = spec.panes[0]?.layers[0];
    expect(candles?.visual).toBe("candlestick");
    expect(candles?.ports.time).toBe("candles_src.timestamp");
    expect(candles?.ports.close).toBe("candles_src.close");

    const sma20 = spec.panes[0]?.layers[1];
    expect(sma20?.visual).toBe("line");
    expect(sma20?.ports.value).toBe("sma20.value");
    expect(sma20?.ports.time).toBe("candles_src.timestamp");
    expect(sma20?.style?.color).toBeDefined();

    expect(spec.data.graph).toBe(GOLDEN_CROSS);
    expect(spec.data.outputs).toContain("candles_src.close");
    expect(spec.data.outputs).toContain("sma20.value");
    expect(spec.data.outputs).toContain("sma50.value");
    expect(spec.data.outputs).not.toContain("cross.signal");
  });

  it("throws when graph has no candles datasource", () => {
    const graph: GraphSpec = {
      id: "empty",
      version: 1,
      kind: "chart",
      nodes: [{ id: "sma20", kind: "indicator.sma", params: { period: 20 } }],
      edges: [],
    };

    expect(() => buildChartBlockSpecFromStudy(graph)).toThrow(
      /datasource\.candles/,
    );
  });
});
