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

export type StudyStatus = "draft" | "applied" | "archived";

export type StudyCreatedBy = "user" | "agent";

/** Flat study from GET/POST/PUT /studies. */
export interface Study {
  id: string;
  status: StudyStatus;
  /** Study revision for concurrency — not graph.version. */
  version: number;
  updated_at: string;
  graph: GraphSpec;
  title?: string;
  created_by?: StudyCreatedBy;
  presentation_overrides?: unknown;
}

export interface CreateStudyRequest {
  graph: GraphSpec;
  title?: string;
  created_by?: StudyCreatedBy;
  presentation_overrides?: unknown;
}

export interface UpdateStudyRequest {
  graph?: GraphSpec;
  title?: string;
  presentation_overrides?: unknown;
  expected_version?: number;
  /** Set to `"applied"` to accept a draft. */
  status?: StudyStatus;
}
