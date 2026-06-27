import { toLineSeriesData } from "@/lib/chart/mapSeries";
import { CHART_COLORS } from "@/lib/chart/theme";
import { parseSeriesF64, parseSeriesI64 } from "@/lib/studio/api";
import type { IndicatorDefinition } from "./types";

export const SMA_KIND = "indicator.sma";
export const TEMP_SMA_INSTANCE_ID = "sma-20";

export const smaDefinition: IndicatorDefinition = {
  kind: SMA_KIND,
  label: (params) => `SMA ${params.period ?? 20}`,
  defaultParams: { period: 20 },
  configSchema: [
    { name: "period", type: "number", label: "Period", min: 1 },
  ],
  seriesStyle: { color: CHART_COLORS.sma, lineWidth: 2 },
  contribute: ({ dsNodeId, nodeId, params }) => ({
    nodes: [{ id: nodeId, kind: SMA_KIND, params }],
    edges: [{ from: `${dsNodeId}.close`, to: `${nodeId}.input` }],
    outputPorts: [`${nodeId}.value`],
  }),
  parseLineData: (response, nodeId, dsNodeId) => {
    const timestamps = parseSeriesI64(
      response.outputs[`${dsNodeId}.timestamp`],
      `${dsNodeId}.timestamp`,
    );
    const values = parseSeriesF64(
      response.outputs[`${nodeId}.value`],
      `${nodeId}.value`,
    );
    return toLineSeriesData(timestamps, values);
  },
};

export const INDICATOR_REGISTRY: Record<string, IndicatorDefinition> = {
  [SMA_KIND]: smaDefinition,
};
