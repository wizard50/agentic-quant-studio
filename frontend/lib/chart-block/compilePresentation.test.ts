import { describe, expect, it } from "vitest";
import type { GraphSpec } from "@/lib/studio/types";
import {
  compilePresentation,
  preferContextPane,
  resolvePaneFromConsumerPeers,
  resolvePaneFromInputs,
} from "./compilePresentation";
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
    { from: "ds1.timestamp", to: "level30.reference" },
    { from: "rsi14.value", to: "reclaim.fast" },
    { from: "level30.value", to: "reclaim.slow" },
  ],
};

describe("preferContextPane", () => {
  it("returns first subchart in order, else main", () => {
    expect(preferContextPane([])).toBe(MAIN_PANE_ID);
    expect(preferContextPane([MAIN_PANE_ID])).toBe(MAIN_PANE_ID);
    expect(preferContextPane([MAIN_PANE_ID, "rsi14"])).toBe("rsi14");
    expect(preferContextPane(["rsi14", "macd"])).toBe("rsi14");
    expect(preferContextPane(["macd", "rsi14"])).toBe("macd");
  });
});

describe("resolvePaneFromConsumerPeers", () => {
  it("returns null for orphan nodes with no outgoing edges", () => {
    const paneByNodeId = new Map([["rsi14", "rsi14"]]);
    expect(
      resolvePaneFromConsumerPeers("orphan", [], paneByNodeId),
    ).toBeNull();
  });

  it("prefers peer subchart pane", () => {
    const paneByNodeId = new Map([
      ["rsi14", "rsi14"],
      ["sma20", MAIN_PANE_ID],
    ]);
    const edges = [
      { from: "rsi14.value", to: "reclaim.fast" },
      { from: "level30.value", to: "reclaim.slow" },
    ];
    expect(
      resolvePaneFromConsumerPeers("level30", edges, paneByNodeId),
    ).toBe("rsi14");
  });
});

describe("resolvePaneFromInputs", () => {
  it("prefers first subchart input pane", () => {
    const paneByNodeId = new Map([
      ["rsi14", "rsi14"],
      ["macd", "macd"],
    ]);
    const edges = [
      { from: "rsi14.value", to: "cmp.left" },
      { from: "macd.value", to: "cmp.right" },
    ];
    expect(resolvePaneFromInputs("cmp", edges, paneByNodeId)).toBe("rsi14");
  });

  it("falls back to main when all inputs are overlays", () => {
    const paneByNodeId = new Map([
      ["sma20", MAIN_PANE_ID],
      ["sma50", MAIN_PANE_ID],
    ]);
    const edges = [
      { from: "sma20.value", to: "cross.fast" },
      { from: "sma50.value", to: "cross.slow" },
    ];
    expect(resolvePaneFromInputs("cross", edges, paneByNodeId)).toBe(
      MAIN_PANE_ID,
    );
  });
});

describe("compilePresentation", () => {
  it("places RSI level and reclaim markers on the RSI subchart", () => {
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
    expect(rsiPane.layers.map((layer) => layer.id)).toEqual([
      "rsi14",
      "level30",
      "reclaim",
    ]);

    const rsi = rsiPane.layers[0]!;
    expect(rsi.visual).toBe("line");
    expect(rsi.ports.value).toBe("rsi14.value");
    expect(rsi.value_range).toEqual({ min: 0, max: 100 });

    const level = rsiPane.layers[1]!;
    expect(level.visual).toBe("line");
    expect(level.ports.value).toBe("level30.value");
    expect(level.ports.time).toBe("ds1.timestamp");
    expect(level.value_range).toEqual({ min: 0, max: 100 });
    expect(level.style?.color).toBe("#a1a1aa");

    const reclaim = rsiPane.layers[2]!;
    expect(reclaim.visual).toBe("markers");
    expect(reclaim.ports.signal).toBe("reclaim.signal");
    expect(reclaim.ports.time).toBe("ds1.timestamp");
    expect(reclaim.style?.markerShape).toBe("arrowUp");

    expect(spec.data.outputs).toContain("ds1.close");
    expect(spec.data.outputs).toContain("sma20.value");
    expect(spec.data.outputs).toContain("rsi14.value");
    expect(spec.data.outputs).toContain("level30.value");
    expect(spec.data.outputs).toContain("reclaim.signal");
  });

  it("skips orphan literal.number with no outgoing edges", () => {
    const graph: GraphSpec = {
      id: "orphan-literal",
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
        { id: "level", kind: "literal.number", params: { value: 100 } },
      ],
      edges: [
        { from: "ds1.close", to: "sma20.input" },
        { from: "ds1.timestamp", to: "level.reference" },
      ],
    };

    const spec = compilePresentation(graph);
    const allLayerIds = spec.panes.flatMap((pane) =>
      pane.layers.map((layer) => layer.id),
    );
    expect(allLayerIds).not.toContain("level");
    expect(spec.data.outputs).not.toContain("level.value");
  });

  it("places crossover markers on main for SMA-only graphs", () => {
    const graph: GraphSpec = {
      id: "sma-cross",
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
        { id: "cross", kind: "logic.crossover", params: {} },
      ],
      edges: [
        { from: "ds1.close", to: "sma20.input" },
        { from: "ds1.close", to: "sma50.input" },
        { from: "sma20.value", to: "cross.fast" },
        { from: "sma50.value", to: "cross.slow" },
      ],
    };

    const spec = compilePresentation(graph);
    expect(spec.panes).toHaveLength(1);
    expect(spec.panes[0]?.layers.map((l) => l.id)).toEqual([
      MARKET_LAYER_ID,
      "sma20",
      "sma50",
      "cross",
    ]);
    expect(spec.panes[0]?.layers[3]?.visual).toBe("markers");
    expect(spec.data.outputs).toContain("cross.signal");
  });

  it("prefers first input pane when logic spans two subcharts", () => {
    const graph: GraphSpec = {
      id: "two-subcharts",
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
        // Second RSI is still subchart role via catalog
        { id: "rsi28", kind: "indicator.rsi", params: { period: 28 } },
        { id: "cmp", kind: "logic.gt", params: {} },
      ],
      edges: [
        { from: "ds1.close", to: "rsi14.input" },
        { from: "ds1.close", to: "rsi28.input" },
        { from: "rsi14.value", to: "cmp.left" },
        { from: "rsi28.value", to: "cmp.right" },
      ],
    };

    const spec = compilePresentation(graph);
    const rsi14Pane = spec.panes.find((pane) => pane.id === "rsi14");
    const rsi28Pane = spec.panes.find((pane) => pane.id === "rsi28");
    expect(rsi14Pane?.layers.some((l) => l.id === "cmp")).toBe(true);
    expect(rsi28Pane?.layers.some((l) => l.id === "cmp")).toBe(false);
    expect(
      rsi14Pane?.layers.find((l) => l.id === "cmp")?.style?.markerShape,
    ).toBe("circle");
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
