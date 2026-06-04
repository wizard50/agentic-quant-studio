use chrono::{DateTime, Utc};
use common::types::{Exchange, Interval, MarketCategory};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CandlePathParams {
    pub exchange: Exchange,
    pub category: MarketCategory,
    pub symbol: String,
    pub interval: Interval,
}

#[derive(Debug, Deserialize)]
pub struct CandleQueryParams {
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct CandleLoad {
    pub exchange: Exchange,
    pub category: MarketCategory,
    pub symbol: String,
    pub interval: Interval,
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
    pub limit: Option<u32>,
}

impl CandleLoad {
    pub fn new(path: CandlePathParams, query: CandleQueryParams) -> Self {
        Self {
            exchange: path.exchange,
            category: path.category,
            symbol: path.symbol,
            interval: path.interval,
            start: query.start,
            end: query.end,
            limit: query.limit,
        }
    }
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
