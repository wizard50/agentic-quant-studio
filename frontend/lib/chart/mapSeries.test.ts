import { describe, expect, it } from "vitest";
import { toLineSeriesData } from "./mapSeries";

describe("toLineSeriesData", () => {
  it("pairs timestamps with values and skips null entries", () => {
    const points = toLineSeriesData(
      [1_700_000_000_000, null, 1_700_086_400_000],
      [100, 200, 110],
    );

    expect(points).toEqual([
      { time: 1_700_000_000, value: 100 },
      { time: 1_700_086_400, value: 110 },
    ]);
  });
});
