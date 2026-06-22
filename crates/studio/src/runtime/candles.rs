use super::value::{SeriesF64, SeriesI64};
use crate::error::{Error, Result};
use common::types::{Candle, Exchange, Interval, MarketCategory};
use serde_json::Value;
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CandleQuery {
    pub exchange: Exchange,
    pub category: MarketCategory,
    pub symbol: String,
    pub interval: Interval,
    pub start_ms: Option<i64>,
    pub end_ms: Option<i64>,
    pub limit: Option<u32>,
}

impl CandleQuery {
    pub fn from_params(params: &Value) -> Result<Self> {
        let exchange = required_str(params, "exchange")?;
        let category = required_str(params, "category")?;
        let symbol = required_str(params, "symbol")?;
        let interval = required_str(params, "interval")?;

        Ok(Self {
            exchange: parse_exchange(&exchange)?,
            category: parse_market_category(&category)?,
            symbol,
            interval: parse_interval(&interval)?,
            start_ms: optional_i64(params, "start_ms")?,
            end_ms: optional_i64(params, "end_ms")?,
            limit: optional_u32(params, "limit")?,
        })
    }
}

#[derive(Debug, Clone)]
pub struct OhlcvSeries {
    pub timestamp: SeriesI64,
    pub open: SeriesF64,
    pub high: SeriesF64,
    pub low: SeriesF64,
    pub close: SeriesF64,
    pub volume: SeriesF64,
}

pub fn candles_to_series(candles: &[Candle]) -> OhlcvSeries {
    let mut timestamp = Vec::with_capacity(candles.len());
    let mut open = Vec::with_capacity(candles.len());
    let mut high = Vec::with_capacity(candles.len());
    let mut low = Vec::with_capacity(candles.len());
    let mut close = Vec::with_capacity(candles.len());
    let mut volume = Vec::with_capacity(candles.len());

    for candle in candles {
        timestamp.push(Some(candle.timestamp));
        open.push(Some(candle.open));
        high.push(Some(candle.high));
        low.push(Some(candle.low));
        close.push(Some(candle.close));
        volume.push(Some(candle.volume));
    }

    OhlcvSeries {
        timestamp: SeriesI64 { values: timestamp },
        open: SeriesF64 { values: open },
        high: SeriesF64 { values: high },
        low: SeriesF64 { values: low },
        close: SeriesF64 { values: close },
        volume: SeriesF64 { values: volume },
    }
}

fn required_str(params: &Value, name: &str) -> Result<String> {
    let value = params
        .get(name)
        .ok_or_else(|| Error::ParamNotFound(name.to_string()))?;

    value
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| Error::InvalidParameter(format!("{name} must be a string")))
}

fn optional_i64(params: &Value, name: &str) -> Result<Option<i64>> {
    match params.get(name) {
        None => Ok(None),
        Some(value) => value
            .as_i64()
            .ok_or_else(|| Error::InvalidParameter(format!("{name} must be an integer")))
            .map(Some),
    }
}

fn optional_u32(params: &Value, name: &str) -> Result<Option<u32>> {
    match params.get(name) {
        None => Ok(None),
        Some(value) => {
            let raw = value.as_u64().ok_or_else(|| {
                Error::InvalidParameter(format!("{name} must be a positive integer"))
            })?;
            u32::try_from(raw)
                .map_err(|_| Error::InvalidParameter(format!("{name} must fit in u32")))
                .map(Some)
        }
    }
}

pub fn parse_exchange(value: &str) -> Result<Exchange> {
    Exchange::from_str(value)
        .map_err(|err| crate::error::Error::InvalidParameter(format!("exchange: {err}")))
}

pub fn parse_market_category(value: &str) -> Result<MarketCategory> {
    MarketCategory::from_str(value)
        .map_err(|err| crate::error::Error::InvalidParameter(format!("category: {err}")))
}

pub fn parse_interval(value: &str) -> Result<Interval> {
    Interval::from_str(value)
        .map_err(|err| crate::error::Error::InvalidParameter(format!("interval: {err}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::{Exchange, Interval, MarketCategory};

    #[test]
    fn candle_query_from_params_parses_required_fields() {
        let params = serde_json::json!({
            "exchange": "bybit",
            "category": "spot",
            "symbol": "BTCUSDT",
            "interval": "1d"
        });

        let query = CandleQuery::from_params(&params).unwrap();
        assert_eq!(query.exchange, Exchange::Bybit);
        assert_eq!(query.category, MarketCategory::Spot);
        assert_eq!(query.symbol, "BTCUSDT");
        assert_eq!(query.interval, Interval::Day(1));
        assert_eq!(query.limit, None);
    }

    #[test]
    fn candles_to_series_maps_ohlcv_columns() {
        let candles = vec![
            Candle {
                timestamp: 1_700_000_000_000,
                open: 1.0,
                high: 2.0,
                low: 0.5,
                close: 1.5,
                volume: 10.0,
            },
            Candle {
                timestamp: 1_700_086_400_000,
                open: 1.5,
                high: 2.5,
                low: 1.0,
                close: 2.0,
                volume: 11.0,
            },
        ];

        let series = candles_to_series(&candles);
        assert_eq!(series.close.values, vec![Some(1.5), Some(2.0)]);
        assert_eq!(
            series.timestamp.values,
            vec![Some(1_700_000_000_000), Some(1_700_086_400_000)]
        );
    }
}
