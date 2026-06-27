import type {
  SmaRunParams,
  StudioRunRequest,
  StudioRunResponse,
  StudioSeriesValue,
} from "./types";

export const DEFAULT_SMA_PERIOD = 20;

const STUDIO_RUNS_URL = "/api/backend/v1/studio/runs";

export function buildSmaRunRequest({
  settings,
  period,
}: SmaRunParams): StudioRunRequest {
  const { exchange, category, symbol, interval } = settings;

  return {
    graph: {
      id: "ds-sma",
      version: 1,
      kind: "chart",
      nodes: [
        {
          id: "ds1",
          kind: "datasource.candles",
          params: { exchange, category, symbol, interval },
        },
        {
          id: "sma20",
          kind: "indicator.sma",
          params: { period },
        },
      ],
      edges: [{ from: "ds1.close", to: "sma20.input" }],
    },
    outputs: ["ds1.timestamp", "sma20.value"],
  };
}

export async function runStudioGraph(
  request: StudioRunRequest,
): Promise<StudioRunResponse> {
  const res = await fetch(STUDIO_RUNS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error(`Studio run failed: ${res.status}`);
  }

  return res.json() as Promise<StudioRunResponse>;
}

export function parseSeriesI64(
  value: StudioSeriesValue | undefined,
  port: string,
): (number | null)[] {
  if (!value || value.kind !== "series_i64" || !value.values) {
    throw new Error(`Expected series_i64 for ${port}`);
  }

  return value.values as (number | null)[];
}

export function parseSeriesF64(
  value: StudioSeriesValue | undefined,
  port: string,
): (number | null)[] {
  if (!value || value.kind !== "series_f64" || !value.values) {
    throw new Error(`Expected series_f64 for ${port}`);
  }

  return value.values as (number | null)[];
}
