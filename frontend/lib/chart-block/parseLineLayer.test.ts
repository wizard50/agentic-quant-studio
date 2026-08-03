import { describe, expect, it } from "vitest";
import type { StudioRunResponse } from "@/lib/studio/types";
import type { Candle } from "@/lib/types";
import {
  parseLineLayerData,
  parseLineLayerDataFromPorts,
} from "./parseLineLayer";
import type { LayerSpec } from "./types";

const candles: Candle[] = [
  {
    timestamp: 1_700_000_000_000,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volume: 10,
  },
  {
    timestamp: 1_700_000_060_000,
    open: 1.5,
    high: 2.5,
    low: 1,
    close: 2,
    volume: 12,
  },
];

const response: StudioRunResponse = {
  outputs: {
    "ds1.timestamp": {
      kind: "series_i64",
      values: [1_700_000_000_000, 1_700_000_060_000],
    },
    "sma20.value": {
      kind: "series_f64",
      values: [1.2, 1.8],
    },
  },
  meta: { graph_id: "g" },
};

const layer: LayerSpec = {
  id: "sma20",
  visual: "line",
  ports: {
    time: "ds1.timestamp",
    value: "sma20.value",
  },
  style: { color: "#f59e0b" },
};

describe("parseLineLayerDataFromPorts", () => {
  it("parses series_f64 without indicator definition", () => {
    const points = parseLineLayerDataFromPorts(response, layer, candles);
    expect(points).not.toBeNull();
    expect(points!.length).toBe(2);
    expect(points!.every((p) => "value" in p)).toBe(true);
  });

  it("returns null when value port missing from response", () => {
    const empty: StudioRunResponse = {
      outputs: {
        "ds1.timestamp": {
          kind: "series_i64",
          values: [1_700_000_000_000],
        },
      },
      meta: { graph_id: "g" },
    };
    expect(parseLineLayerDataFromPorts(empty, layer, candles)).toBeNull();
  });
});

describe("parseLineLayerData", () => {
  it("falls back to ports when no indicator layer provided", () => {
    const points = parseLineLayerData(response, layer, candles);
    expect(points).not.toBeNull();
    expect(points!.length).toBe(2);
  });
});
