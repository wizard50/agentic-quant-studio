import { describe, expect, it } from "vitest";
import type { GraphSpec } from "@/lib/studio/types";
import { compilePresentation } from "./compilePresentation";
import { DEFAULT_SUBCHART_PANE_HEIGHT, MAIN_PANE_ID } from "./constants";
import { MARKET_LAYER_ID } from "./layers";

const RSI_RECLAIM: GraphSpec = {
  id: "rsi-reclaim",
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
    { id: "rsi14", kind: "indicator.rsi", params: { period: 14 } },
    { id: "sma20", kind: "indicator.sma", params: { period: 20 } },
    { id: "level30", kind: "literal.number", params: { value: 30 } },
    { id: "reclaim", kind: "logic.crossover", params: {} },
  ],
  edges: [
    { from: "ds1.close", to: "rsi14.input" },
    { from: "ds1.close", to: "sma20.input" },
    { from: "rsi14.value", to: "reclaim.fast" },
    { from: "level30.value", to: "reclaim.slow" },
  ],
};

describe("compilePresentation", () => {
  it("puts SMA on main and RSI on its own subchart with value_range", () => {
    const spec = compilePresentation(RSI_RECLAIM);

    expect(spec.panes.map((pane) => pane.id)).toEqual([
      MAIN_PANE_ID,
      "rsi14",
    ]);

    const main = spec.panes[0]!;
    expect(main.role).toBe("main");
    expect(main.layers.map((layer) => layer.id)).toEqual([
      MARKET_LAYER_ID,
      "sma20",
    ]);

    const rsiPane = spec.panes[1]!;
    expect(rsiPane.role).toBe("subchart");
    expect(rsiPane.height).toBe(DEFAULT_SUBCHART_PANE_HEIGHT);
    expect(rsiPane.layers).toHaveLength(1);
    expect(rsiPane.layers[0]?.id).toBe("rsi14");
    expect(rsiPane.layers[0]?.ports.value).toBe("rsi14.value");
    expect(rsiPane.layers[0]?.value_range).toEqual({ min: 0, max: 100 });

    expect(spec.data.outputs).toContain("ds1.close");
    expect(spec.data.outputs).toContain("sma20.value");
    expect(spec.data.outputs).toContain("rsi14.value");
    expect(spec.data.outputs).not.toContain("reclaim.signal");
    expect(spec.data.outputs).not.toContain("level30.value");
  });

  it("keeps overlays-only graphs on a single main pane", () => {
    const graph: GraphSpec = {
      id: "sma-only",
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
      ],
      edges: [{ from: "ds1.close", to: "sma20.input" }],
    };

    const spec = compilePresentation(graph);
    expect(spec.panes).toHaveLength(1);
    expect(spec.panes[0]?.layers.map((l) => l.id)).toEqual([
      MARKET_LAYER_ID,
      "sma20",
    ]);
  });

  it("defaults unknown indicator kinds to overlay", () => {
    const graph: GraphSpec = {
      id: "unknown",
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
        { id: "x", kind: "indicator.unknown_future", params: {} },
      ],
      edges: [],
    };

    const spec = compilePresentation(graph);
    expect(spec.panes).toHaveLength(1);
    expect(spec.panes[0]?.layers.some((l) => l.id === "x")).toBe(true);
  });

  it("throws when graph has no candles datasource", () => {
    const graph: GraphSpec = {
      id: "empty",
      version: 1,
      kind: "chart",
      nodes: [{ id: "sma20", kind: "indicator.sma", params: { period: 20 } }],
      edges: [],
    };

    expect(() => compilePresentation(graph)).toThrow(/datasource\.candles/);
  });
});
