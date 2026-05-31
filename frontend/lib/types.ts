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

// --- Ingestion Job types (from /v1/candles/ingest/jobs) ---

export type IngestJobStatus = "pending" | "running" | "completed" | "failed";

export interface IngestJob {
  id: string;
  exchange: string;
  category: string;
  symbol: string;
  interval: string;
  status: IngestJobStatus;
  created_at: string;
  finished_at: string | null;
  error: string | null;
}
