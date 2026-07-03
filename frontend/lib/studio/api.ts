import type {
  StudioRunRequest,
  StudioRunResponse,
  StudioSeriesValue,
} from "./types";

const STUDIO_RUNS_URL = "/api/backend/v1/studio/runs";

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
