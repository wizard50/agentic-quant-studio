import { describe, expect, it } from "vitest";
import { buildSmaRunRequest } from "./api";

describe("buildSmaRunRequest", () => {
  it("uses chart settings and SMA params in the graph body", () => {
    const request = buildSmaRunRequest({
      settings: {
        exchange: "bybit",
        category: "spot",
        symbol: "BTCUSDT",
        interval: "1d",
      },
      period: 20,
    });

    expect(request.graph.nodes[0]).toEqual({
      id: "ds1",
      kind: "datasource.candles",
      params: {
        exchange: "bybit",
        category: "spot",
        symbol: "BTCUSDT",
        interval: "1d",
      },
    });
    expect(request.graph.nodes[1]).toEqual({
      id: "sma20",
      kind: "indicator.sma",
      params: { period: 20 },
    });
    expect(request.outputs).toEqual(["ds1.timestamp", "sma20.value"]);
  });
});
