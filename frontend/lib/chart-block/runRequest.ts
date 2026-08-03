import type { StudioRunRequest } from "@/lib/studio/types";
import { findCandlesDatasource } from "./datasource";
import { deriveOutputs } from "./deriveOutputs";
import type { ChartBlockSpec } from "./types";

export interface ViewportRange {
  limit?: number;
  startMs?: number;
  endMs?: number;
}

export function buildStudioRunRequest(
  spec: ChartBlockSpec,
  range?: ViewportRange,
): StudioRunRequest {
  const graph = structuredClone(spec.data.graph);
  const datasource = findCandlesDatasource(graph);

  if (!datasource) {
    throw new Error(
      "Chart block graph is missing a datasource.candles node",
    );
  }

  datasource.params = { ...datasource.params };

  if (range?.limit != null) {
    datasource.params.limit = range.limit;
  }
  if (range?.startMs != null) {
    datasource.params.start_ms = range.startMs;
  }
  if (range?.endMs != null) {
    datasource.params.end_ms = range.endMs;
  }

  return {
    graph,
    outputs: deriveOutputs(spec),
  };
}
