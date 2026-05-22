use crate::error::Result;
use async_trait::async_trait;
use common::types::{Candle, Interval};

#[async_trait]
pub trait ExchangeApi {
    async fn get_candles(&self, params: CandlesRequest) -> Result<Vec<Candle>>;
}

#[derive(Debug, Clone)]
pub struct CandlesRequest {
    pub symbol: String,
    pub interval: Interval,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub limit: Option<u32>,
}
