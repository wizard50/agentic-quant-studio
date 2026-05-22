use crate::{config::Config, models::candle::CandleQuery};
use anyhow::Result;
use common::types::{Candle, Interval};
use warehouse::parquet;

pub fn get_candles(config: &Config, query: CandleQuery) -> Result<Vec<Candle>> {
    let parquet_base_dir = config.parquet_base_dir();

    let candles = if query.interval == Interval::Minute(1) {
        parquet::load_candles(
            parquet_base_dir,
            query.exchange.as_str(),
            query.category.as_str(),
            query.symbol.as_str(),
            "1min",
            query.start.map(|dt| dt.timestamp_millis()),
            query.end.map(|dt| dt.timestamp_millis()),
            query.limit.map(|v| v as usize),
        )?
    } else {
        // TODO: limit
        parquet::load_resampled_candles(
            parquet_base_dir,
            query.exchange.as_str(),
            query.category.as_str(),
            query.symbol.as_str(),
            query.interval,
            query.start.map(|dt| dt.timestamp_millis()),
            query.end.map(|dt| dt.timestamp_millis()),
        )?
    };

    Ok(candles)
}
