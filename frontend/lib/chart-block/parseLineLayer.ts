import {
  alignLineSeriesToCandles,
  type LineSeriesPoint,
} from "@/lib/chart/mapSeries";
import type { IndicatorChartLayer } from "./layers";
import { lookupIndicatorDefinition } from "@/lib/indicators";
import type { StudioRunResponse } from "@/lib/studio/types";
import type { Candle } from "@/lib/types";
import { DS_NODE_ID } from "./constants";
import type { LayerSpec } from "./types";

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

  if (!definition) {
    return null;
  }

  const parsed = definition.parseLineData(response, nodeId, DS_NODE_ID);
  return alignLineSeriesToCandles(candles, parsed);
}
