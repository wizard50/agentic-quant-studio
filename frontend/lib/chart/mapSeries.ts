import type { LineData, Time, WhitespaceData } from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { toChartTime } from "./mapCandles";

export type LineSeriesPoint = LineData<Time> | WhitespaceData<Time>;

export function toLineSeriesData(
  timestamps: (number | null)[],
  values: (number | null)[],
): LineSeriesPoint[] {
  const length = Math.min(timestamps.length, values.length);
  const points: LineSeriesPoint[] = [];

  for (let i = 0; i < length; i++) {
    const timestamp = timestamps[i];
    const value = values[i];

    if (timestamp == null) {
      continue;
    }

    const time = toChartTime(timestamp);
    if (value == null) {
      points.push({ time });
      continue;
    }

    points.push({
      time,
      value,
    });
  }

  return points;
}

export function alignLineSeriesToCandles(
  candles: Candle[],
  lineData: LineSeriesPoint[],
): LineSeriesPoint[] {
  const byTime = new Map<Time, LineSeriesPoint>();

  for (const point of lineData) {
    byTime.set(point.time, point);
  }

  return candles.map((candle) => {
    const time = toChartTime(candle.timestamp);
    return byTime.get(time) ?? { time };
  });
}
