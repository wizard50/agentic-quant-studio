import { describe, expect, it } from "vitest";
import type { IndicatorChartLayer } from "@/lib/chart-block";
import { createVolumeBuiltinLayer } from "./builtins";
import {
  buildAutoscaleInfoProvider,
  buildLineSeriesOptions,
  filterLineIndicatorLayers,
  filterOverlayIndicatorLayers,
  filterSubchartIndicatorLayers,
  isLineIndicatorLayer,
  isOverlayIndicatorLayer,
  isSubchart,
  isSubchartIndicatorLayer,
} from "./render";
import { lookupIndicatorDefinition } from "./registry";

function makeLayer(
  overrides: Partial<IndicatorChartLayer> = {},
): IndicatorChartLayer {
  return {
    id: "rsi-1",
    kind: "indicator",
    indicatorKind: "indicator.rsi",
    params: { period: 14 },
    visible: true,
    color: "#ff0000",
    ...overrides,
  };
}

describe("indicator render", () => {
  it("identifies subchart indicators from chart role", () => {
    expect(isSubchart(lookupIndicatorDefinition("indicator.rsi")!)).toBe(true);
    expect(isSubchart(lookupIndicatorDefinition("indicator.sma")!)).toBe(false);
  });

  it("partitions indicator layers by chart role and series type", () => {
    const layers = [
      createVolumeBuiltinLayer(),
      makeLayer(),
      makeLayer({ id: "sma-1", indicatorKind: "indicator.sma" }),
    ];

    expect(isSubchartIndicatorLayer(layers[0]!)).toBe(true);
    expect(isSubchartIndicatorLayer(layers[1]!)).toBe(true);
    expect(isOverlayIndicatorLayer(layers[2]!)).toBe(true);
    expect(filterSubchartIndicatorLayers(layers)).toHaveLength(2);
    expect(filterOverlayIndicatorLayers(layers)).toHaveLength(1);
    expect(filterLineIndicatorLayers(layers)).toHaveLength(2);
    expect(isLineIndicatorLayer(layers[0]!)).toBe(false);
    expect(isLineIndicatorLayer(layers[1]!)).toBe(true);
  });

  it("builds fixed autoscale range for subcharts", () => {
    const provider = buildAutoscaleInfoProvider({
      role: "subchart",
      value_range: { min: 0, max: 100 },
    });

    expect(provider?.()).toEqual({
      priceRange: { minValue: 0, maxValue: 100 },
    });
    expect(buildAutoscaleInfoProvider({ role: "overlay" })).toBeUndefined();
  });

  it("builds line series options without embedding on the price chart", () => {
    const layer = makeLayer();
    const definition = lookupIndicatorDefinition("indicator.rsi")!;

    expect(buildLineSeriesOptions(layer, definition)).toMatchObject({
      color: "#ff0000",
      visible: true,
      title: "RSI 14",
      crosshairMarkerVisible: false,
    });
    expect(
      buildLineSeriesOptions(layer, definition).priceScaleId,
    ).toBeUndefined();

    const autoscaleInfoProvider = buildLineSeriesOptions(layer, definition)
      .autoscaleInfoProvider as
      | (() => { priceRange: { minValue: number; maxValue: number } })
      | undefined;

    expect(autoscaleInfoProvider?.()).toEqual({
      priceRange: { minValue: 0, maxValue: 100 },
    });
  });
});
