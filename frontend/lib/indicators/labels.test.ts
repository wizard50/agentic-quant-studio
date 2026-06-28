import { describe, expect, it } from "vitest";
import {
  getIndicatorDescription,
  getIndicatorLabel,
  getIndicatorName,
} from "./labels";

describe("indicator labels", () => {
  it("returns the registry name without params for the browser", () => {
    expect(getIndicatorName("indicator.sma")).toBe("SMA");
  });

  it("returns the registry description when available", () => {
    expect(getIndicatorDescription("indicator.sma")).toBe(
      "Simple moving average",
    );
  });

  it("uses the parameterized label for active chart chips", () => {
    expect(getIndicatorLabel("indicator.sma")).toBe("SMA 20");
  });

  it("falls back to the kind slug for unknown indicators", () => {
    expect(getIndicatorName("indicator.ema")).toBe("EMA");
    expect(getIndicatorDescription("indicator.ema")).toBeUndefined();
  });
});
