import { describe, expect, it, vi } from "vitest";
import type { IChartApi, LogicalRange } from "lightweight-charts";
import {
  preserveViewportOnPrepend,
  shouldLoadOlderHistory,
} from "./preserveViewport";

function logicalRange(from: number, to: number): LogicalRange {
  return { from, to } as LogicalRange;
}

describe("shouldLoadOlderHistory", () => {
  it("returns false when barsBefore is null or undefined", () => {
    expect(shouldLoadOlderHistory(null)).toBe(false);
    expect(shouldLoadOlderHistory(undefined)).toBe(false);
  });

  it("returns true when bars before the viewport are within the threshold", () => {
    expect(shouldLoadOlderHistory(10)).toBe(true);
  });

  it("returns false when enough bars remain before the viewport", () => {
    expect(shouldLoadOlderHistory(50)).toBe(false);
  });
});

describe("preserveViewportOnPrepend", () => {
  it("shifts the visible logical range by bars added", () => {
    const setVisibleLogicalRange = vi.fn();
    const chart = {
      timeScale: () => ({ setVisibleLogicalRange }),
    } as unknown as IChartApi;

    preserveViewportOnPrepend(chart, 50, logicalRange(10, 100));

    expect(setVisibleLogicalRange).toHaveBeenCalledWith({ from: 60, to: 150 });
  });

  it("does nothing when bars added is zero", () => {
    const setVisibleLogicalRange = vi.fn();
    const chart = {
      timeScale: () => ({ setVisibleLogicalRange }),
    } as unknown as IChartApi;

    preserveViewportOnPrepend(chart, 0, logicalRange(10, 100));

    expect(setVisibleLogicalRange).not.toHaveBeenCalled();
  });

  it("does nothing when the range before update is null", () => {
    const setVisibleLogicalRange = vi.fn();
    const chart = {
      timeScale: () => ({ setVisibleLogicalRange }),
    } as unknown as IChartApi;

    preserveViewportOnPrepend(chart, 50, null);

    expect(setVisibleLogicalRange).not.toHaveBeenCalled();
  });
});
