import { describe, expect, it } from "vitest";
import { buildIndicatorRunRequest } from "./buildRunRequest";
import { TEMP_SMA_INSTANCE_ID } from "./registry";

describe("buildIndicatorRunRequest", () => {
  it("composes a shared datasource with indicator nodes", () => {
    const request = buildIndicatorRunRequest({
      settings: {
        exchange: "bybit",
        category: "spot",
        symbol: "BTCUSDT",
        interval: "1d",
      },
      instances: [
        {
          id: TEMP_SMA_INSTANCE_ID,
          kind: "indicator.sma",
          params: { period: 20 },
          visible: true,
          color: "#f59e0b",
        },
      ],
      limit: 500,
    });

    expect(request).not.toBeNull();
    expect(request?.graph.nodes[0]).toEqual({
      id: "ds1",
      kind: "datasource.candles",
      params: {
        exchange: "bybit",
        category: "spot",
        symbol: "BTCUSDT",
        interval: "1d",
        limit: 500,
      },
    });
    expect(request?.graph.nodes[1]).toEqual({
      id: TEMP_SMA_INSTANCE_ID,
      kind: "indicator.sma",
      params: { period: 20 },
    });
    expect(request?.graph.edges).toEqual([
      { from: "ds1.close", to: `${TEMP_SMA_INSTANCE_ID}.input` },
    ]);
    expect(request?.outputs).toEqual([
      "ds1.timestamp",
      `${TEMP_SMA_INSTANCE_ID}.value`,
    ]);
  });

  it("returns null when no visible instances are active", () => {
    const request = buildIndicatorRunRequest({
      settings: {
        exchange: "bybit",
        category: "spot",
        symbol: "BTCUSDT",
        interval: "1d",
      },
      instances: [
        {
          id: TEMP_SMA_INSTANCE_ID,
          kind: "indicator.sma",
          params: { period: 20 },
          visible: false,
          color: "#f59e0b",
        },
      ],
    });

    expect(request).toBeNull();
  });
});
