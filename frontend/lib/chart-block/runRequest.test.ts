import { describe, expect, it } from "vitest";
import { DATASOURCE_PORTS } from "./constants";
import { buildStudioRunRequest } from "./runRequest";
import type { ChartBlockSpec } from "./types";

const spec: ChartBlockSpec = {
  id: "test",
  version: 1,
  data: {
    graph: {
      id: "chart-block",
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
    },
    outputs: ["ds1.timestamp", "ds1.close"],
  },
  panes: [
    {
      id: "main",
      role: "main",
      height: "flex",
      layers: [
        {
          id: "candles",
          visual: "candlestick",
          ports: {
            time: DATASOURCE_PORTS.time,
            close: DATASOURCE_PORTS.close,
          },
        },
      ],
    },
  ],
};

describe("buildStudioRunRequest", () => {
  it("derives outputs from pane layer ports", () => {
    const request = buildStudioRunRequest(spec);

    expect(request.outputs).toEqual(["ds1.close", "ds1.timestamp"]);
    expect(request.graph.nodes[0]?.params).toEqual({
      exchange: "bybit",
      category: "spot",
      symbol: "BTCUSDT",
      interval: "1d",
    });
  });

  it("applies viewport range params to the datasource node", () => {
    const request = buildStudioRunRequest(spec, {
      limit: 500,
      startMs: 1_700_000_000_000,
      endMs: 1_700_086_400_000,
    });

    expect(request.graph.nodes[0]?.params).toEqual({
      exchange: "bybit",
      category: "spot",
      symbol: "BTCUSDT",
      interval: "1d",
      limit: 500,
      start_ms: 1_700_000_000_000,
      end_ms: 1_700_086_400_000,
    });
  });
});
