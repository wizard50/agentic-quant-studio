import type { StudioRunRequest } from "@/lib/studio/types";
import { DS_NODE_ID } from "./constants";
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
  const datasource = graph.nodes.find((node) => node.id === DS_NODE_ID);

  if (!datasource) {
    throw new Error(
      `Chart block graph is missing datasource node "${DS_NODE_ID}"`,
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
