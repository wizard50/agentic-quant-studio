import type { Time } from "lightweight-charts";
import { describe, expect, it } from "vitest";
import { alignLineSeriesToCandles, toLineSeriesData } from "./mapSeries";
import type { Candle } from "@/lib/types";

const candles: Candle[] = [
  {
    timestamp: 1_000,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volume: 10,
  },
  {
    timestamp: 2_000,
    open: 1.5,
    high: 2.5,
    low: 1,
    close: 2,
    volume: 11,
  },
  {
    timestamp: 3_000,
    open: 2,
    high: 3,
    low: 1.5,
    close: 2.5,
    volume: 12,
  },
];

describe("toLineSeriesData", () => {
  it("pairs timestamps with values and skips null timestamps", () => {
    const points = toLineSeriesData(
      [1_700_000_000_000, null, 1_700_086_400_000],
      [100, 200, 110],
    );

    expect(points).toEqual([
      { time: 1_700_000_000, value: 100 },
      { time: 1_700_086_400, value: 110 },
    ]);
  });

  it("keeps aligned timestamps as whitespace when values are null", () => {
    const points = toLineSeriesData(
      [1_700_000_000_000, 1_700_043_200_000, 1_700_086_400_000],
      [null, 50, 110],
    );

    expect(points).toEqual([
      { time: 1_700_000_000 },
      { time: 1_700_043_200, value: 50 },
      { time: 1_700_086_400, value: 110 },
    ]);
  });
});

describe("alignLineSeriesToCandles", () => {
  it("drops warmup bars outside the candle cache", () => {
    const aligned = alignLineSeriesToCandles(candles, [
      { time: 0 as Time, value: 10 },
      { time: 1 as Time, value: 20 },
      { time: 2 as Time, value: 30 },
      { time: 3 as Time, value: 40 },
    ]);

    expect(aligned).toEqual([
      { time: 1, value: 20 },
      { time: 2, value: 30 },
      { time: 3, value: 40 },
    ]);
  });

  it("fills missing indicator timestamps with whitespace", () => {
    const aligned = alignLineSeriesToCandles(candles, [
      { time: 1 as Time, value: 20 },
      { time: 3 as Time, value: 40 },
    ]);

    expect(aligned).toEqual([
      { time: 1, value: 20 },
      { time: 2 },
      { time: 3, value: 40 },
    ]);
  });
});
