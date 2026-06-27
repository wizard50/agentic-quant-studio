import type { SeriesKey } from "@/lib/chart";

export interface GraphSpec {
  id: string;
  version: number;
  kind: "chart";
  nodes: NodeSpec[];
  edges: EdgeSpec[];
}

export interface NodeSpec {
  id: string;
  kind: string;
  params: Record<string, string | number>;
}

export interface EdgeSpec {
  from: string;
  to: string;
}

export interface StudioRunRequest {
  graph: GraphSpec;
  outputs: string[];
}

export interface StudioSeriesValue {
  kind: "series_i64" | "series_f64" | "series_bool" | "f64" | "bool";
  values?: (number | boolean | null)[];
  value?: number | boolean;
}

export interface StudioRunMeta {
  graph_id: string;
  length?: number;
}

export interface StudioRunResponse {
  outputs: Record<string, StudioSeriesValue>;
  meta: StudioRunMeta;
}

export interface SmaRunParams {
  settings: SeriesKey;
  period: number;
}
