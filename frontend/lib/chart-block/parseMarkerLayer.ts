import type { SeriesMarker, Time } from "lightweight-charts";
import { toChartTime } from "@/lib/chart/mapCandles";
import { parseSeriesBool, parseSeriesI64 } from "@/lib/studio/api";
import type { StudioRunResponse } from "@/lib/studio/types";
import type { LayerSpec, MarkerShape } from "./types";

function isMarkerShape(value: string | undefined): value is MarkerShape {
  return (
    value === "arrowUp" ||
    value === "arrowDown" ||
    value === "circle" ||
    value === "square"
  );
}

/**
 * Parse a markers LayerSpec (ports.time + ports.signal series_bool)
 * into Lightweight Charts bar markers for true bars only.
 */
export function parseMarkerLayerData(
  response: StudioRunResponse,
  layer: LayerSpec,
): SeriesMarker<Time>[] | null {
  const timePort = layer.ports.time;
  const signalPort = layer.ports.signal;

  if (!timePort || !signalPort) {
    return null;
  }

  const timeOutput = response.outputs[timePort];
  const signalOutput = response.outputs[signalPort];

  if (
    !timeOutput ||
    timeOutput.kind !== "series_i64" ||
    !signalOutput ||
    signalOutput.kind !== "series_bool"
  ) {
    return null;
  }

  const timestamps = parseSeriesI64(timeOutput, timePort);
  const signals = parseSeriesBool(signalOutput, signalPort);
  const length = Math.min(timestamps.length, signals.length);

  const shape: MarkerShape = isMarkerShape(layer.style?.markerShape)
    ? layer.style.markerShape
    : "circle";
  const color = layer.style?.color ?? "#a855f7";
  const markers: SeriesMarker<Time>[] = [];

  for (let i = 0; i < length; i += 1) {
    const timestamp = timestamps[i];
    const signal = signals[i];

    if (timestamp == null || signal !== true) {
      continue;
    }

    markers.push({
      time: toChartTime(timestamp),
      position: shape === "arrowDown" ? "aboveBar" : "belowBar",
      shape,
      color,
      id: `${layer.id}-${i}`,
    });
  }

  return markers;
}
