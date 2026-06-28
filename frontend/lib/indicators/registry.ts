import { toLineSeriesData } from "@/lib/chart/mapSeries";
import { parseSeriesF64, parseSeriesI64 } from "@/lib/studio/api";
import type { IndicatorDefinition, IndicatorParams } from "./types";

export const SMA_KIND = "indicator.sma";
export const EMA_KIND = "indicator.ema";
export const RSI_KIND = "indicator.rsi";
export const TEMP_SMA_INSTANCE_ID = "sma-20";

interface CloseLineIndicatorConfig {
  kind: string;
  name: string;
  description?: string;
  defaultPeriod: number;
}

function defineCloseLineIndicator(
  config: CloseLineIndicatorConfig,
): IndicatorDefinition {
  const { kind, name, description, defaultPeriod } = config;

  return {
    kind,
    name,
    description,
    label: (params: IndicatorParams) =>
      `${name} ${params.period ?? defaultPeriod}`,
    defaultParams: { period: defaultPeriod },
    configSchema: [{ name: "period", type: "number", label: "Period", min: 1 }],
    seriesStyle: { lineWidth: 2 },
    contribute: ({ dsNodeId, nodeId, params }) => ({
      nodes: [{ id: nodeId, kind, params }],
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
}

export const smaDefinition = defineCloseLineIndicator({
  kind: SMA_KIND,
  name: "SMA",
  description: "Simple moving average",
  defaultPeriod: 20,
});

export const emaDefinition = defineCloseLineIndicator({
  kind: EMA_KIND,
  name: "EMA",
  description: "Exponential moving average",
  defaultPeriod: 20,
});

export const rsiDefinition = defineCloseLineIndicator({
  kind: RSI_KIND,
  name: "RSI",
  description: "Relative strength index",
  defaultPeriod: 14,
});

export const INDICATOR_REGISTRY: Record<string, IndicatorDefinition> = {
  [SMA_KIND]: smaDefinition,
  [EMA_KIND]: emaDefinition,
  [RSI_KIND]: rsiDefinition,
};
