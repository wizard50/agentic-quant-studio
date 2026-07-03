import { beforeEach, describe, expect, it, vi } from "vitest";
import { DATASOURCE_PORTS, type ChartBlockSpec } from "@/lib/chart-block";
import type { StudioRunResponse } from "@/lib/studio/types";
import { Datafeed } from "./datafeed";

const { runStudioGraphMock } = vi.hoisted(() => ({
  runStudioGraphMock: vi.fn(),
}));

vi.mock("@/lib/studio/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/studio/api")>();

  return {
    ...actual,
    runStudioGraph: runStudioGraphMock,
  };
});

const key = {
  exchange: "bybit",
  category: "spot",
  symbol: "BTCUSDT",
  interval: "1m",
};

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
          params: key,
        },
      ],
      edges: [],
    },
    outputs: [
      "ds1.timestamp",
      "ds1.open",
      "ds1.high",
      "ds1.low",
      "ds1.close",
      "ds1.volume",
    ],
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
            open: DATASOURCE_PORTS.open,
            high: DATASOURCE_PORTS.high,
            low: DATASOURCE_PORTS.low,
            close: DATASOURCE_PORTS.close,
          },
        },
      ],
    },
    {
      id: "volume",
      role: "subchart",
      height: 120,
      layers: [
        {
          id: "volume",
          visual: "histogram",
          ports: {
            time: DATASOURCE_PORTS.time,
            value: DATASOURCE_PORTS.volume,
          },
        },
      ],
    },
  ],
};

function makeResponse(
  timestamps: number[],
  startPrice = 100,
): StudioRunResponse {
  return {
    outputs: {
      "ds1.timestamp": {
        kind: "series_i64",
        values: timestamps,
      },
      "ds1.open": {
        kind: "series_f64",
        values: timestamps.map((_, index) => startPrice + index),
      },
      "ds1.high": {
        kind: "series_f64",
        values: timestamps.map((_, index) => startPrice + index + 1),
      },
      "ds1.low": {
        kind: "series_f64",
        values: timestamps.map((_, index) => startPrice + index - 1),
      },
      "ds1.close": {
        kind: "series_f64",
        values: timestamps.map((_, index) => startPrice + index + 0.5),
      },
      "ds1.volume": {
        kind: "series_f64",
        values: timestamps.map(() => 1),
      },
    },
    meta: { graph_id: "chart-block" },
  };
}

describe("Datafeed", () => {
  beforeEach(() => {
    runStudioGraphMock.mockReset();
  });

  it("loads initial candles from a studio run", async () => {
    runStudioGraphMock.mockResolvedValueOnce(
      makeResponse([1_000, 2_000, 3_000]),
    );

    const feed = new Datafeed();
    const events: string[] = [];

    feed.subscribe((event) => {
      events.push(event.type);
    });
    feed.configure(spec, 0);
    feed.reset(key);
    await feed.loadInitial(3);

    expect(runStudioGraphMock).toHaveBeenCalledOnce();
    expect(feed.getCandleCount()).toBe(3);
    expect(feed.getLastResponse()).not.toBeNull();
    expect(events).toContain("replace");
  });

  it("extends initial limit by configured warmup bars", async () => {
    runStudioGraphMock.mockResolvedValueOnce(
      makeResponse([1_000, 2_000, 3_000]),
    );

    const feed = new Datafeed();
    feed.configure(spec, 20);
    feed.reset(key);
    await feed.loadInitial(3);

    const request = runStudioGraphMock.mock.calls[0]?.[0];
    expect(request.graph.nodes[0]?.params.limit).toBe(23);
  });

  it("refetches with warmup padding when refreshing an existing window", async () => {
    runStudioGraphMock
      .mockResolvedValueOnce(makeResponse([2_000, 3_000, 4_000]))
      .mockResolvedValueOnce(makeResponse([1_000, 2_000, 3_000, 4_000]));

    const feed = new Datafeed();
    feed.configure(spec, 2);
    feed.reset(key);
    await feed.loadInitial(3);
    await feed.refresh();

    const refreshRequest = runStudioGraphMock.mock.calls[1]?.[0];
    expect(refreshRequest.graph.nodes[0]?.params.limit).toBe(5);
    expect(refreshRequest.graph.nodes[0]?.params.start_ms).toBe(0);
    expect(refreshRequest.graph.nodes[0]?.params.end_ms).toBe(4_000);
  });

  it("prepends older candles when history is extended", async () => {
    runStudioGraphMock
      .mockResolvedValueOnce(makeResponse([1_000, 2_000, 3_000]))
      .mockResolvedValueOnce(makeResponse([500, 1_000, 2_000, 3_000]));

    const feed = new Datafeed();
    const events: string[] = [];

    feed.subscribe((event) => {
      events.push(event.type);
    });
    feed.configure(spec, 0);
    feed.reset(key);
    await feed.loadInitial(3);
    await feed.loadOlder(1);

    expect(runStudioGraphMock).toHaveBeenCalledTimes(2);
    expect(feed.getCandleCount()).toBe(4);
    expect(events).toContain("prepend");
  });
});
