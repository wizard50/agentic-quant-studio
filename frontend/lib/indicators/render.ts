import type {
  AutoscaleInfo,
  LineSeriesPartialOptions,
} from "lightweight-charts";
import type { ChartDefaults } from "./catalog";
import { INDICATOR_REGISTRY } from "./registry";
import type { IndicatorDefinition, IndicatorInstance } from "./types";

export function isOscillator(definition: IndicatorDefinition): boolean {
  return definition.chartDefaults?.role === "oscillator";
}

export function isOscillatorInstance(instance: IndicatorInstance): boolean {
  const definition = INDICATOR_REGISTRY[instance.kind];
  return definition ? isOscillator(definition) : false;
}

export function isOverlayInstance(instance: IndicatorInstance): boolean {
  return !isOscillatorInstance(instance);
}

export function filterOverlayInstances(
  instances: IndicatorInstance[],
): IndicatorInstance[] {
  return instances.filter(isOverlayInstance);
}

export function filterOscillatorInstances(
  instances: IndicatorInstance[],
): IndicatorInstance[] {
  return instances.filter(isOscillatorInstance);
}

export function buildAutoscaleInfoProvider(
  chartDefaults?: ChartDefaults,
): (() => AutoscaleInfo | null) | undefined {
  const range = chartDefaults?.value_range;
  if (!range) {
    return undefined;
  }

  return () => ({
    priceRange: {
      minValue: range.min,
      maxValue: range.max,
    },
  });
}

export function buildLineSeriesOptions(
  instance: IndicatorInstance,
  definition: IndicatorDefinition,
): LineSeriesPartialOptions {
  const options: LineSeriesPartialOptions = {
    color: instance.color,
    lineWidth: definition.seriesStyle.lineWidth,
    title: definition.label(instance.params),
    visible: instance.visible,
  };

  if (isOscillator(definition)) {
    options.priceFormat = {
      type: "price",
      precision: 2,
      minMove: 0.01,
    };
  }

  const autoscaleInfoProvider = buildAutoscaleInfoProvider(
    definition.chartDefaults,
  );
  if (autoscaleInfoProvider) {
    options.autoscaleInfoProvider = autoscaleInfoProvider;
  }

  return options;
}
