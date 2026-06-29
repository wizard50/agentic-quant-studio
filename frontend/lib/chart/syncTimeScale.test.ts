import { describe, expect, it, vi } from "vitest";
import {
  syncTimeScaleBetween,
  syncVisibleLogicalRangeBetween,
} from "./syncTimeScale";

function createChartMock(
  visibleLogicalRange: { from: number; to: number } | null,
  options: {
    rightOffset?: number;
    barSpacing?: number;
  } = {},
) {
  const applyOptions = vi.fn();
  const setVisibleLogicalRange = vi.fn();
  const getVisibleLogicalRange = vi.fn(() => visibleLogicalRange);
  const optionsFn = vi.fn(() => ({
    rightOffset: options.rightOffset ?? 0,
    rightOffsetPixels: undefined,
    barSpacing: options.barSpacing ?? 6,
  }));

  const chart = {
    timeScale: () => ({
      applyOptions,
      getVisibleLogicalRange,
      setVisibleLogicalRange,
      options: optionsFn,
    }),
  };

  return {
    chart,
    applyOptions,
    setVisibleLogicalRange,
    getVisibleLogicalRange,
    optionsFn,
  };
}

describe("syncTimeScale", () => {
  it("copies logical range and bar spacing from source to target", () => {
    const source = createChartMock(
      { from: 420, to: 520 },
      { rightOffset: 12, barSpacing: 8 },
    );
    const target = createChartMock(
      { from: 0, to: 100 },
      { rightOffset: 0, barSpacing: 6 },
    );

    expect(
      syncTimeScaleBetween(source.chart as never, target.chart as never),
    ).toBe(true);

    expect(target.applyOptions).toHaveBeenCalledWith({
      rightOffset: 12,
      rightOffsetPixels: undefined,
      barSpacing: 8,
    });
    expect(target.setVisibleLogicalRange).toHaveBeenCalledWith({
      from: 420,
      to: 520,
    });
  });

  it("skips option updates when the target already matches", () => {
    const source = createChartMock(
      { from: 10, to: 20 },
      { rightOffset: 4, barSpacing: 7 },
    );
    const target = createChartMock(
      { from: 0, to: 5 },
      { rightOffset: 4, barSpacing: 7 },
    );

    syncTimeScaleBetween(source.chart as never, target.chart as never);

    expect(target.applyOptions).not.toHaveBeenCalled();
    expect(target.setVisibleLogicalRange).toHaveBeenCalledWith({
      from: 10,
      to: 20,
    });
  });

  it("syncs only the logical range on the hot scroll path", () => {
    const source = createChartMock({ from: 30, to: 45 });
    const target = createChartMock(null);

    expect(
      syncVisibleLogicalRangeBetween(
        source.chart as never,
        target.chart as never,
      ),
    ).toBe(true);

    expect(target.applyOptions).not.toHaveBeenCalled();
    expect(target.setVisibleLogicalRange).toHaveBeenCalledWith({
      from: 30,
      to: 45,
    });
  });

  it("returns false when the target chart cannot apply the range yet", () => {
    const source = createChartMock({ from: 420, to: 520 });
    const target = createChartMock(null);
    target.setVisibleLogicalRange.mockImplementation(() => {
      throw new Error("Value is null");
    });

    expect(
      syncTimeScaleBetween(source.chart as never, target.chart as never),
    ).toBe(false);
  });

  it("skips syncing when source and target are the same chart", () => {
    const source = createChartMock({ from: 10, to: 20 });

    expect(
      syncTimeScaleBetween(source.chart as never, source.chart as never),
    ).toBe(false);
    expect(source.setVisibleLogicalRange).not.toHaveBeenCalled();
  });
});
