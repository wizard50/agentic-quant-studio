use crate::{config::Config, jobs::types::IngestCandlesPayload, models::candle::CandleQuery};
use anyhow::Result;
use common::types::{Candle, Interval};
use std::path::PathBuf;
use tracing::info;
use uuid::Uuid;
use warehouse::{candle_downloader, parquet};

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

pub async fn execute_ingestion(
    payload: &IngestCandlesPayload,
    from: Option<i64>,
    base_dir: &PathBuf,
    job_id: Uuid,
) -> Result<(), warehouse::error::Error> {
    if let Some(from_ts) = from {
        info!(job_id = %job_id, from = %from_ts, "Incremental ingestion");
        candle_downloader::store_history(
            payload.exchange,
            payload.category,
            &payload.symbol,
            Some(from_ts),
            base_dir.clone(),
        )
        .await
    } else {
        info!(job_id = %job_id, "Full history ingestion");
        candle_downloader::store_full_history(
            payload.exchange,
            payload.category,
            &payload.symbol,
            base_dir.clone(),
        )
        .await
    }
}
