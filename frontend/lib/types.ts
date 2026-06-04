export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// --- Catalog types (from /v1/catalog/candles) ---

export interface DatasetCoverage {
  exchange: string;
  category: string;
  symbol: string;
  interval: string;
  from: number;
  to: number;
  record_count: number;
  approx_size_bytes: number;
  last_updated: string;
}

export interface CatalogSnapshot {
  version: number;
  generated_at: string;
  datasets: DatasetCoverage[];
}

export interface CatalogSummary {
  totalDatasets: number;
  totalCandles: number;
  storageBytes: number;
  lastUpdated: string | null;
}

// --- Ingestion Job types (from /api/backend/v1/jobs) ---
// Matches backend JobInfo response (jobs are now generic, not tied to a single ingest payload shape).

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobInfo {
  id: string;
  kind: string; // e.g. "ingest_candles"
  status: JobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}
