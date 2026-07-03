import type {
  AutoscaleInfo,
  LineSeriesPartialOptions,
} from "lightweight-charts";
import type { IndicatorChartLayer } from "@/lib/chart-block";
import type { ChartDefaults } from "./catalog";
import { getIndicatorDefinition, getIndicatorLayerLabel } from "./instance";
import type { IndicatorDefinition } from "./types";

export function isOverlay(definition: IndicatorDefinition): boolean {
  return definition.chartDefaults?.role === "overlay";
}

export function isSubchart(definition: IndicatorDefinition): boolean {
  return definition.chartDefaults?.role === "subchart";
}

export function seriesTypeForDefinition(
  definition: IndicatorDefinition,
): NonNullable<ChartDefaults["series_type"]> {
  return definition.chartDefaults.series_type ?? "line";
}

function matchesIndicatorLayer(
  layer: IndicatorChartLayer,
  predicate: (definition: IndicatorDefinition) => boolean,
): boolean {
  const definition = getIndicatorDefinition(layer);
  return definition ? predicate(definition) : false;
}

export function isLineIndicatorLayer(layer: IndicatorChartLayer): boolean {
  return matchesIndicatorLayer(
    layer,
    (definition) => seriesTypeForDefinition(definition) === "line",
  );
}

export function isOverlayIndicatorLayer(layer: IndicatorChartLayer): boolean {
  return matchesIndicatorLayer(layer, isOverlay);
}

export function isSubchartIndicatorLayer(layer: IndicatorChartLayer): boolean {
  return matchesIndicatorLayer(layer, isSubchart);
}

export function filterLineIndicatorLayers(
  layers: IndicatorChartLayer[],
): IndicatorChartLayer[] {
  return layers.filter(isLineIndicatorLayer);
}

export function filterOverlayIndicatorLayers(
  layers: IndicatorChartLayer[],
): IndicatorChartLayer[] {
  return layers.filter(isOverlayIndicatorLayer);
}

export function filterSubchartIndicatorLayers(
  layers: IndicatorChartLayer[],
): IndicatorChartLayer[] {
  return layers.filter(isSubchartIndicatorLayer);
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
  layer: IndicatorChartLayer,
  definition: IndicatorDefinition,
  visible: boolean = layer.visible,
): LineSeriesPartialOptions {
  const options: LineSeriesPartialOptions = {
    color: layer.color,
    lineWidth: definition.seriesStyle.lineWidth,
    title: getIndicatorLayerLabel(layer),
    visible,
    crosshairMarkerVisible: false,
  };

  if (definition.chartDefaults.value_range) {
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
