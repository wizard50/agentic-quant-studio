import type { LineData, Time } from "lightweight-charts";
import { toChartTime } from "./mapCandles";

export function toLineSeriesData(
  timestamps: (number | null)[],
  values: (number | null)[],
): LineData<Time>[] {
  const length = Math.min(timestamps.length, values.length);
  const points: LineData<Time>[] = [];

  for (let i = 0; i < length; i++) {
    const timestamp = timestamps[i];
    const value = values[i];

    if (timestamp == null || value == null) {
      continue;
    }

    points.push({
      time: toChartTime(timestamp),
      value,
    });
  }

  return points;
}
