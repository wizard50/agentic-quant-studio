use super::candles::CandleQuery;
use crate::error::Result;
use async_trait::async_trait;
use common::types::Candle;
use std::sync::Arc;

#[async_trait]
pub trait CandleSource: Send + Sync {
    async fn load_candles(&self, query: &CandleQuery) -> Result<Vec<Candle>>;
}

pub struct ExecutionContext {
    candles: Arc<dyn CandleSource>,
}

impl ExecutionContext {
    pub fn new(candles: Arc<dyn CandleSource>) -> Self {
        Self { candles }
    }

    pub fn candles(&self) -> &dyn CandleSource {
        self.candles.as_ref()
    }
}

pub struct FakeCandleSource {
    candles: Vec<Candle>,
}

impl FakeCandleSource {
    pub fn new(candles: Vec<Candle>) -> Self {
        Self { candles }
    }
}

#[async_trait]
impl CandleSource for FakeCandleSource {
    async fn load_candles(&self, _query: &CandleQuery) -> Result<Vec<Candle>> {
        Ok(self.candles.clone())
    }
}
