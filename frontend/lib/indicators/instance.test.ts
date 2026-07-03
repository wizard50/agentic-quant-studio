import { describe, expect, it } from "vitest";
import type { IndicatorChartLayer } from "@/lib/chart-block";
import {
  createInstanceId,
  defaultParamsFromCatalog,
  getIndicatorDefinition,
  getIndicatorLayerColor,
  getIndicatorLayerLabel,
} from "./instance";
import { lookupIndicatorDefinition } from "./registry";

describe("indicator layer helpers", () => {
  it("creates graph-safe layer ids from dotted kinds", () => {
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

  it("labels indicator layers with their configured params", () => {
    const layer: IndicatorChartLayer = {
      id: "sma-1",
      kind: "indicator",
      indicatorKind: "indicator.sma",
      params: { period: 50 },
      visible: true,
      color: "#3b82f6",
    };

    expect(getIndicatorLayerLabel(layer)).toBe("SMA 50");
  });

  it("resolves the registry definition for an indicator layer", () => {
    const layer: IndicatorChartLayer = {
      id: "sma-1",
      kind: "indicator",
      indicatorKind: "indicator.sma",
      params: { period: 20 },
      visible: true,
      color: "#ec4899",
    };

    expect(getIndicatorDefinition(layer)).toBe(
      lookupIndicatorDefinition("indicator.sma"),
    );
  });

  it("returns the color assigned to the indicator layer", () => {
    const layer: IndicatorChartLayer = {
      id: "sma-1",
      kind: "indicator",
      indicatorKind: "indicator.sma",
      params: { period: 20 },
      visible: true,
      color: "#ec4899",
    };

    expect(getIndicatorLayerColor(layer)).toBe("#ec4899");
  });
});
