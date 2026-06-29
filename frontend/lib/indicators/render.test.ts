import { describe, expect, it } from "vitest";
import {
  buildAutoscaleInfoProvider,
  buildLineSeriesOptions,
  filterOscillatorInstances,
  filterOverlayInstances,
  isOscillator,
  isOscillatorInstance,
  isOverlayInstance,
} from "./render";
import { INDICATOR_REGISTRY, RSI_KIND, SMA_KIND } from "./registry";
import type { IndicatorInstance } from "./types";

function makeInstance(
  overrides: Partial<IndicatorInstance> = {},
): IndicatorInstance {
  return {
    id: "rsi-1",
    kind: RSI_KIND,
    params: { period: 14 },
    visible: true,
    color: "#ff0000",
    ...overrides,
  };
}

describe("indicator render", () => {
  it("identifies oscillator indicators from chart role", () => {
    expect(isOscillator(INDICATOR_REGISTRY[RSI_KIND]!)).toBe(true);
    expect(isOscillator(INDICATOR_REGISTRY[SMA_KIND]!)).toBe(false);
  });

  it("partitions instances by chart role", () => {
    const instances = [
      makeInstance(),
      makeInstance({ id: "sma-1", kind: SMA_KIND }),
    ];

    expect(isOscillatorInstance(instances[0]!)).toBe(true);
    expect(isOverlayInstance(instances[1]!)).toBe(true);
    expect(filterOscillatorInstances(instances)).toHaveLength(1);
    expect(filterOverlayInstances(instances)).toHaveLength(1);
  });

  it("builds fixed autoscale range for oscillators", () => {
    const provider = buildAutoscaleInfoProvider({
      role: "oscillator",
      value_range: { min: 0, max: 100 },
    });

    expect(provider?.()).toEqual({
      priceRange: { minValue: 0, maxValue: 100 },
    });
    expect(buildAutoscaleInfoProvider({ role: "overlay" })).toBeUndefined();
  });

  it("builds line series options without embedding on the price chart", () => {
    const instance = makeInstance();
    const definition = INDICATOR_REGISTRY[RSI_KIND]!;

    expect(buildLineSeriesOptions(instance, definition)).toMatchObject({
      color: "#ff0000",
      visible: true,
      title: "RSI 14",
    });
    expect(
      buildLineSeriesOptions(instance, definition).priceScaleId,
    ).toBeUndefined();

    const autoscaleInfoProvider = buildLineSeriesOptions(instance, definition)
      .autoscaleInfoProvider as
      | (() => { priceRange: { minValue: number; maxValue: number } })
      | undefined;

    expect(autoscaleInfoProvider?.()).toEqual({
      priceRange: { minValue: 0, maxValue: 100 },
    });
  });
});
