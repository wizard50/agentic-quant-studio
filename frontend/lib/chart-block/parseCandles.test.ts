import { describe, expect, it } from "vitest";
import { studioResponseToCandles } from "./parseCandles";
import type { StudioRunResponse } from "@/lib/studio/types";

const OHLC_OUTPUTS = [
  "ds1.timestamp",
  "ds1.open",
  "ds1.high",
  "ds1.low",
  "ds1.close",
] as const;

const OHLCV_OUTPUTS = [...OHLC_OUTPUTS, "ds1.volume"] as const;

function makeResponse(includeVolume: boolean): StudioRunResponse {
  const outputs: StudioRunResponse["outputs"] = {
    "ds1.timestamp": {
      kind: "series_i64",
      values: [1_000, 2_000],
    },
    "ds1.open": {
      kind: "series_f64",
      values: [100, 101],
    },
    "ds1.high": {
      kind: "series_f64",
      values: [110, 111],
    },
    "ds1.low": {
      kind: "series_f64",
      values: [90, 91],
    },
    "ds1.close": {
      kind: "series_f64",
      values: [105, 106],
    },
  };

  if (includeVolume) {
    outputs["ds1.volume"] = {
      kind: "series_f64",
      values: [12, 13],
    };
  }

  return {
    outputs,
    meta: { graph_id: "chart-block" },
  };
}

describe("studioResponseToCandles", () => {
  it("maps datasource ports into candle rows when volume was requested", () => {
    expect(
      studioResponseToCandles(makeResponse(true), {
        requestedOutputs: OHLCV_OUTPUTS,
      }),
    ).toEqual([
      {
        timestamp: 1_000,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 12,
      },
      {
        timestamp: 2_000,
        open: 101,
        high: 111,
        low: 91,
        close: 106,
        volume: 13,
      },
    ]);
  });

  it("fills volume with zero when the port was not requested", () => {
    expect(
      studioResponseToCandles(makeResponse(false), {
        requestedOutputs: OHLC_OUTPUTS,
      }),
    ).toEqual([
      {
        timestamp: 1_000,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 0,
      },
      {
        timestamp: 2_000,
        open: 101,
        high: 111,
        low: 91,
        close: 106,
        volume: 0,
      },
    ]);
  });

  it("throws when volume was requested but missing from the response", () => {
    expect(() =>
      studioResponseToCandles(makeResponse(false), {
        requestedOutputs: OHLCV_OUTPUTS,
      }),
    ).toThrow("Expected series_f64 for ds1.volume");
  });
});
