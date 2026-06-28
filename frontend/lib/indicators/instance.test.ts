import { describe, expect, it } from "vitest";
import {
  createInstanceId,
  defaultParamsFromCatalog,
  getInstanceColor,
  getInstanceLabel,
} from "./instance";
import type { IndicatorInstance } from "./types";

describe("indicator instance helpers", () => {
  it("creates graph-safe instance ids from dotted kinds", () => {
    const id = createInstanceId("indicator.sma");

    expect(id.startsWith("indicator-sma-")).toBe(true);
    expect(id.includes(".")).toBe(false);
  });

  it("builds default params from catalog metadata", () => {
    const params = defaultParamsFromCatalog({
      kind: "indicator.sma",
      inputs: [],
      outputs: [],
      params: [{ name: "period", type: "integer", default: 20, min: 1 }],
    });

    expect(params).toEqual({ period: 20 });
  });

  it("labels instances with their configured params", () => {
    const instance: IndicatorInstance = {
      id: "sma-1",
      kind: "indicator.sma",
      params: { period: 50 },
      visible: true,
      color: "#3b82f6",
    };

    expect(getInstanceLabel(instance)).toBe("SMA 50");
  });

  it("returns the color assigned to the instance", () => {
    const instance: IndicatorInstance = {
      id: "sma-1",
      kind: "indicator.sma",
      params: { period: 20 },
      visible: true,
      color: "#ec4899",
    };

    expect(getInstanceColor(instance)).toBe("#ec4899");
  });
});
