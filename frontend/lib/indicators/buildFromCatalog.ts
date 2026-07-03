import { toLineSeriesData } from "@/lib/chart/mapSeries";
import { parseSeriesF64, parseSeriesI64 } from "@/lib/studio/api";
import { DEFAULT_SUBCHART_PANE_HEIGHT } from "@/lib/chart-block/constants";
import type {
  CatalogParam,
  ChartDefaults,
  IndicatorCatalogEntry,
} from "./catalog";
import type { IndicatorDefinition, IndicatorParams, ParamField } from "./types";

const DEFAULT_LINE_WIDTH = 2 as const;
const DATASOURCE_CLOSE_PORT = "close";
const DATASOURCE_TIMESTAMP_PORT = "timestamp";

function fallbackName(kind: string): string {
  const slug = kind.split(".").pop() ?? kind;
  return slug.toUpperCase();
}

function paramLabel(name: string): string {
  if (name.length === 0) {
    return name;
  }

  return name[0].toUpperCase() + name.slice(1);
}

function defaultParamsFromEntry(params: CatalogParam[]): IndicatorParams {
  const result: IndicatorParams = {};

  for (const param of params) {
    const value = param.default;
    if (typeof value === "string" || typeof value === "number") {
      result[param.name] = value;
    }
  }

  return result;
}

function configSchemaFromEntry(params: CatalogParam[]): ParamField[] {
  return params
    .filter(
      (param) =>
        param.type === "integer" ||
        param.type === "number" ||
        param.type === "string",
    )
    .map((param) => ({
      name: param.name,
      type: param.type === "string" ? "string" : "number",
      label: paramLabel(param.name),
      min: typeof param.min === "number" ? param.min : undefined,
      max: typeof param.max === "number" ? param.max : undefined,
    }));
}

export function normalizeChartDefaults(raw?: ChartDefaults): ChartDefaults {
  if (!raw) {
    return { role: "overlay", series_type: "line" };
  }

  const isSubchart = raw.role === "subchart";

  return {
    role: raw.role,
    series_type: raw.series_type ?? "line",
    value_range: raw.value_range,
    warmup_bars: raw.warmup_bars,
    default_pane_height: isSubchart
      ? (raw.default_pane_height ?? DEFAULT_SUBCHART_PANE_HEIGHT)
      : raw.default_pane_height,
  };
}

function primarySeriesPort(
  ports: IndicatorCatalogEntry["inputs"] | IndicatorCatalogEntry["outputs"],
  fallback: string,
): string {
  return ports.find((port) => port.series)?.name ?? fallback;
}

function buildLabel(kind: string): (params: IndicatorParams) => string {
  const name = fallbackName(kind);

  return (params) => {
    const period = params.period;
    if (period !== undefined) {
      return `${name} ${period}`;
    }

    return name;
  };
}

export function definitionFromCatalogEntry(
  entry: IndicatorCatalogEntry,
): IndicatorDefinition {
  const inputPort = primarySeriesPort(entry.inputs, "input");
  const outputPort = primarySeriesPort(entry.outputs, "value");
  const chartDefaults = normalizeChartDefaults(entry.chart_defaults);

  return {
    kind: entry.kind,
    name: fallbackName(entry.kind),
    defaultParams: defaultParamsFromEntry(entry.params),
    configSchema: configSchemaFromEntry(entry.params),
    chartDefaults,
    seriesStyle: { lineWidth: DEFAULT_LINE_WIDTH },
    label: buildLabel(entry.kind),
    contribute: ({ dsNodeId, nodeId, params }) => ({
      nodes: [{ id: nodeId, kind: entry.kind, params }],
      edges: [
        {
          from: `${dsNodeId}.${DATASOURCE_CLOSE_PORT}`,
          to: `${nodeId}.${inputPort}`,
        },
      ],
      outputPorts: [`${nodeId}.${outputPort}`],
    }),
    parseLineData: (response, nodeId, dsNodeId) => {
      const timestamps = parseSeriesI64(
        response.outputs[`${dsNodeId}.${DATASOURCE_TIMESTAMP_PORT}`],
        `${dsNodeId}.${DATASOURCE_TIMESTAMP_PORT}`,
      );
      const values = parseSeriesF64(
        response.outputs[`${nodeId}.${outputPort}`],
        `${nodeId}.${outputPort}`,
      );

      return toLineSeriesData(timestamps, values);
    },
  };
}
