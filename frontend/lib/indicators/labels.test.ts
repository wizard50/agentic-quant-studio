import { describe, expect, it } from "vitest";
import {
  getIndicatorDescription,
  getIndicatorLabel,
  getIndicatorName,
} from "./labels";

describe("indicator labels", () => {
  it("returns the registry name without params for the browser", () => {
    expect(getIndicatorName("indicator.sma")).toBe("SMA");
    expect(getIndicatorName("indicator.ema")).toBe("EMA");
    expect(getIndicatorName("indicator.rsi")).toBe("RSI");
  });

  it("returns undefined descriptions until the catalog exposes them", () => {
    expect(getIndicatorDescription("indicator.sma")).toBeUndefined();
    expect(getIndicatorDescription("indicator.ema")).toBeUndefined();
    expect(getIndicatorDescription("indicator.rsi")).toBeUndefined();
  });

  it("uses the parameterized label for active chart chips", () => {
    expect(getIndicatorLabel("indicator.sma")).toBe("SMA 20");
    expect(getIndicatorLabel("indicator.ema")).toBe("EMA 20");
    expect(getIndicatorLabel("indicator.rsi")).toBe("RSI 14");
  });

  it("falls back to the kind slug for unknown indicators", () => {
    expect(getIndicatorName("indicator.macd")).toBe("MACD");
    expect(getIndicatorDescription("indicator.macd")).toBeUndefined();
  });
});
