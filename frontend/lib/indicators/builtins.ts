import type { IndicatorChartLayer } from "@/lib/chart-block";
import { CHART_COLORS } from "@/lib/chart/theme";
import { DEFAULT_VOLUME_PANE_HEIGHT } from "@/lib/chart-block/constants";
import type { IndicatorDefinition } from "./types";

export const VOLUME_KIND = "builtin.volume";
export const VOLUME_LAYER_ID = "volume";

/** @deprecated Use VOLUME_LAYER_ID */
export const VOLUME_INSTANCE_ID = VOLUME_LAYER_ID;

export const volumeDefinition: IndicatorDefinition = {
  kind: VOLUME_KIND,
  name: "Volume",
  description: "Trading volume histogram",
  label: () => "Volume",
  defaultParams: {},
  configSchema: [],
  chartDefaults: {
    role: "subchart",
    series_type: "histogram",
    default_pane_height: DEFAULT_VOLUME_PANE_HEIGHT,
    warmup_bars: 0,
  },
  seriesStyle: { lineWidth: 2 },
  contribute: () => ({
    nodes: [],
    edges: [],
    outputPorts: [],
  }),
  parseLineData: () => [],
};

export function createVolumeBuiltinLayer(): IndicatorChartLayer {
  return {
    id: VOLUME_LAYER_ID,
    kind: "indicator",
    indicatorKind: VOLUME_KIND,
    params: {},
    visible: true,
    color: CHART_COLORS.volume,
  };
}

export function isBuiltinIndicatorLayer(layer: IndicatorChartLayer): boolean {
  return layer.indicatorKind === VOLUME_KIND;
}
