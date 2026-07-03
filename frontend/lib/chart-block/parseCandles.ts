import { parseSeriesF64, parseSeriesI64 } from "@/lib/studio/api";
import type { StudioRunResponse } from "@/lib/studio/types";
import type { Candle } from "@/lib/types";
import { DS_NODE_ID } from "./constants";

export interface StudioResponseToCandlesOptions {
  dsNodeId?: string;
  /** Ports requested in the studio run (e.g. from deriveOutputs). */
  requestedOutputs?: readonly string[];
}

function datasourcePort(dsNodeId: string, name: string): string {
  return `${dsNodeId}.${name}`;
}

function parseDatasourceF64(
  response: StudioRunResponse,
  dsNodeId: string,
  name: string,
): (number | null)[] {
  const port = datasourcePort(dsNodeId, name);
  return parseSeriesF64(response.outputs[port], port);
}

export function studioResponseToCandles(
  response: StudioRunResponse,
  options: StudioResponseToCandlesOptions = {},
): Candle[] {
  const dsNodeId = options.dsNodeId ?? DS_NODE_ID;
  const requested = new Set(options.requestedOutputs ?? []);
  const includeVolume = requested.has(datasourcePort(dsNodeId, "volume"));

  const timestamps = parseSeriesI64(
    response.outputs[datasourcePort(dsNodeId, "timestamp")],
    datasourcePort(dsNodeId, "timestamp"),
  );
  const opens = parseDatasourceF64(response, dsNodeId, "open");
  const highs = parseDatasourceF64(response, dsNodeId, "high");
  const lows = parseDatasourceF64(response, dsNodeId, "low");
  const closes = parseDatasourceF64(response, dsNodeId, "close");
  const volumes = includeVolume
    ? parseDatasourceF64(response, dsNodeId, "volume")
    : null;

  const length = Math.min(
    timestamps.length,
    opens.length,
    highs.length,
    lows.length,
    closes.length,
    volumes?.length ?? Number.POSITIVE_INFINITY,
  );

  const candles: Candle[] = [];

  for (let index = 0; index < length; index += 1) {
    const timestamp = timestamps[index];
    const open = opens[index];
    const high = highs[index];
    const low = lows[index];
    const close = closes[index];
    const parsedVolume = includeVolume ? volumes![index] : 0;

    if (
      timestamp == null ||
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      parsedVolume == null
    ) {
      continue;
    }

    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume: parsedVolume,
    });
  }

  return candles;
}
