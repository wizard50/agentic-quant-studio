use chrono::{DateTime, Utc};
use common::types::{Exchange, Interval, MarketCategory};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CandleQuery {
    pub exchange: Exchange,
    pub category: MarketCategory,
    pub symbol: String,
    pub interval: Interval,
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct CandleIngestRequest {
    pub exchange: Exchange,
    pub category: MarketCategory,
    pub symbol: String,
}

#[derive(Debug, Serialize)]
pub struct CandleIngestResponse {
    pub job_id: String,
    pub status: String,
}
