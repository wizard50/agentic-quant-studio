use crate::{config::Config, jobs::types::IngestCandlesPayload, models::candle::CandleLoad};
use common::types::{Candle, Interval};
use std::path::PathBuf;
use tracing::info;
use uuid::Uuid;
use warehouse::{
    candle_downloader,
    catalog::{CatalogSnapshot, DatasetCoverage},
    parquet,
    query::{DatasetBounds, resolve_candle_window},
};

pub fn get_candles(
    config: &Config,
    catalog: &CatalogSnapshot,
    query: CandleLoad,
) -> warehouse::error::Result<Vec<Candle>> {
    let parquet_base_dir = config.parquet_base_dir();
    let storage_interval = "1min";

    let dataset_bounds = resolve_dataset_bounds(
        catalog,
        parquet_base_dir.as_path(),
        query.exchange.as_str(),
        query.category.as_str(),
        &query.symbol,
        storage_interval,
    )?;

    let window = resolve_candle_window(
        query.start.map(|dt| dt.timestamp_millis()),
        query.end.map(|dt| dt.timestamp_millis()),
        query.limit,
        query.interval,
        dataset_bounds,
    )?;

    let candles = if query.interval == Interval::Minute(1) {
        parquet::load_candles(
            parquet_base_dir,
            query.exchange.as_str(),
            query.category.as_str(),
            query.symbol.as_str(),
            storage_interval,
            Some(window.start_ms),
            Some(window.end_ms),
            window.limit.map(|v| v as usize),
        )?
    } else {
        parquet::load_resampled_candles(
            parquet_base_dir,
            query.exchange.as_str(),
            query.category.as_str(),
            query.symbol.as_str(),
            query.interval,
            Some(window.start_ms),
            Some(window.end_ms),
            window.limit.map(|v| v as usize),
        )?
    };

    Ok(candles)
}

fn resolve_dataset_bounds(
    catalog: &CatalogSnapshot,
    parquet_base_dir: &std::path::Path,
    exchange: &str,
    category: &str,
    symbol: &str,
    interval: &str,
) -> warehouse::error::Result<Option<DatasetBounds>> {
    if let Some(bounds) = find_catalog_bounds(catalog, exchange, category, symbol, interval) {
        return Ok(Some(bounds));
    }

    let bounds =
        parquet::dataset_time_bounds(parquet_base_dir, exchange, category, symbol, interval)?;

    Ok(bounds.map(|(from, to)| DatasetBounds { from, to }))
}

fn find_catalog_bounds(
    catalog: &CatalogSnapshot,
    exchange: &str,
    category: &str,
    symbol: &str,
    interval: &str,
) -> Option<DatasetBounds> {
    catalog
        .datasets
        .iter()
        .find(|dataset| dataset_matches(dataset, exchange, category, symbol, interval))
        .map(|dataset| DatasetBounds {
            from: dataset.from,
            to: dataset.to,
        })
}

fn dataset_matches(
    dataset: &DatasetCoverage,
    exchange: &str,
    category: &str,
    symbol: &str,
    interval: &str,
) -> bool {
    dataset.exchange == exchange
        && dataset.category == category
        && dataset.symbol == symbol
        && dataset.interval == interval
}

pub async fn execute_ingestion(
    payload: &IngestCandlesPayload,
    from: Option<i64>,
    base_dir: &PathBuf,
    job_id: Uuid,
) -> warehouse::error::Result<()> {
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
