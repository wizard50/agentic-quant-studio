use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, TimeZone, Utc};
use common::types::Candle;
use studio::{
    error::{Error, Result},
    runtime::{CandleQuery, CandleSource},
};

use crate::{config::Config, models::candle::CandleLoad, services::candle_service};
use warehouse::catalog::CatalogSnapshot;

pub struct WarehouseCandleSource {
    config: Arc<Config>,
    catalog: CatalogSnapshot,
}

impl WarehouseCandleSource {
    pub fn new(config: Arc<Config>, catalog: CatalogSnapshot) -> Self {
        Self { config, catalog }
    }
}

#[async_trait]
impl CandleSource for WarehouseCandleSource {
    async fn load_candles(&self, query: &CandleQuery) -> Result<Vec<Candle>> {
        let load = candle_load_from_query(query)?;
        let config = self.config.clone();
        let catalog = self.catalog.clone();

        let candles = tokio::task::spawn_blocking(move || {
            candle_service::get_candles(&config, &catalog, load)
        })
        .await
        .map_err(|err| Error::DataSource(err.to_string()))?
        .map_err(map_warehouse_error)?;

        Ok(candles)
    }
}

pub fn candle_load_from_query(query: &CandleQuery) -> Result<CandleLoad> {
    Ok(CandleLoad {
        exchange: query.exchange,
        category: query.category,
        symbol: query.symbol.clone(),
        interval: query.interval,
        start: query.start_ms.map(ms_to_datetime).transpose()?,
        end: query.end_ms.map(ms_to_datetime).transpose()?,
        limit: query.limit,
    })
}

fn ms_to_datetime(ms: i64) -> Result<DateTime<Utc>> {
    Utc.timestamp_millis_opt(ms)
        .single()
        .ok_or_else(|| Error::InvalidParameter(format!("invalid timestamp: {ms}")))
}

fn map_warehouse_error(err: warehouse::error::Error) -> Error {
    match err {
        warehouse::error::Error::DatasetNotFound => {
            Error::DataSource("candle dataset not found".to_string())
        }
        warehouse::error::Error::InvalidCandleQuery(message) => Error::InvalidParameter(message),
        other => Error::DataSource(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::{Exchange, Interval, MarketCategory};

    #[test]
    fn candle_load_from_query_maps_fields() {
        let query = CandleQuery {
            exchange: Exchange::Bybit,
            category: MarketCategory::Spot,
            symbol: "BTCUSDT".to_string(),
            interval: Interval::Day(1),
            start_ms: Some(1_700_000_000_000),
            end_ms: Some(1_700_086_400_000),
            limit: Some(500),
        };

        let load = candle_load_from_query(&query).unwrap();
        assert_eq!(load.exchange, Exchange::Bybit);
        assert_eq!(load.category, MarketCategory::Spot);
        assert_eq!(load.symbol, "BTCUSDT");
        assert_eq!(load.interval, Interval::Day(1));
        assert_eq!(load.limit, Some(500));
        assert_eq!(load.start.unwrap().timestamp_millis(), 1_700_000_000_000);
        assert_eq!(load.end.unwrap().timestamp_millis(), 1_700_086_400_000);
    }

    #[test]
    fn map_warehouse_error_dataset_not_found() {
        let err = map_warehouse_error(warehouse::error::Error::DatasetNotFound);
        assert!(matches!(err, Error::DataSource(message) if message == "candle dataset not found"));
    }
}
