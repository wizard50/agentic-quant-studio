import {
  alignLineSeriesToCandles,
  toLineSeriesData,
  type LineSeriesPoint,
} from "@/lib/chart/mapSeries";
import { parseSeriesF64, parseSeriesI64 } from "@/lib/studio/api";
import type { IndicatorChartLayer } from "./layers";
import { lookupIndicatorDefinition } from "@/lib/indicators";
import type { StudioRunResponse } from "@/lib/studio/types";
import type { Candle } from "@/lib/types";
import { DS_NODE_ID } from "./constants";
import type { LayerSpec } from "./types";

/** Port-centric line parse: uses layer.ports.time + layer.ports.value. */
export function parseLineLayerDataFromPorts(
  response: StudioRunResponse,
  layer: LayerSpec,
  candles: Candle[],
): LineSeriesPoint[] | null {
  const timePort = layer.ports.time;
  const valuePort = layer.ports.value;

  if (!timePort || !valuePort) {
    return null;
  }

  const timeOutput = response.outputs[timePort];
  const valueOutput = response.outputs[valuePort];

  if (
    !timeOutput ||
    timeOutput.kind !== "series_i64" ||
    !valueOutput ||
    valueOutput.kind !== "series_f64"
  ) {
    return null;
  }

  const timestamps = parseSeriesI64(timeOutput, timePort);
  const values = parseSeriesF64(valueOutput, valuePort);
  const parsed = toLineSeriesData(timestamps, values);
  return alignLineSeriesToCandles(candles, parsed);
}

export function parseLineLayerData(
  response: StudioRunResponse,
  layer: LayerSpec,
  candles: Candle[],
  indicatorLayer?: IndicatorChartLayer,
): LineSeriesPoint[] | null {
  const nodeId = indicatorLayer?.id ?? layer.id;
  const indicatorKind = indicatorLayer?.indicatorKind;
  const definition = indicatorKind
    ? lookupIndicatorDefinition(indicatorKind)
    : null;

  if (definition) {
    const dsNodeId =
      layer.ports.time?.split(".")[0] ?? DS_NODE_ID;
    const parsed = definition.parseLineData(response, nodeId, dsNodeId);
    return alignLineSeriesToCandles(candles, parsed);
  }

  return parseLineLayerDataFromPorts(response, layer, candles);
}
