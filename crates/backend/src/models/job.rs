use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::services::jobs::ingest_candles::JobStatus;

/// Public API representation of a candle ingestion job.
#[derive(Debug, Serialize)]
pub struct IngestJob {
    pub id: String,
    pub exchange: String,
    pub category: String,
    pub symbol: String,
    pub interval: String,
    /// One of: "pending", "running", "completed", "failed"
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

impl IngestJob {
    pub fn from_status(id: Uuid, status: &JobStatus) -> Self {
        let (exchange, category, symbol, interval, _from, _to) = &status.key;

        Self {
            id: id.to_string(),
            exchange: exchange.as_str().to_string(),
            category: category.as_str().to_string(),
            symbol: symbol.clone(),
            interval: interval.to_string(),
            status: status.status.as_str().to_string(),
            created_at: status.created_at,
            finished_at: status.finished_at,
            error: status.error.clone(),
        }
    }
}

/// Query parameters for listing ingestion jobs.
#[derive(Debug, Default, Deserialize)]
pub struct IngestJobListQuery {
    /// Filter by status (comma-separated, e.g. "pending,running")
    pub status: Option<String>,
    /// Maximum number of jobs to return (default 100, max 500)
    pub limit: Option<u32>,
    /// Return only active jobs (pending + running)
    pub active: Option<bool>,
}
