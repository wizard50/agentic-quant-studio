use super::parquet::write_candles_partitioned;
use crate::error::{Error, Result};
use api_client::exchanges::{CandlesRequest, ExchangeExt};
use chrono::Utc;
use common::types::{Candle, Exchange, Interval, MarketCategory};
use std::path::Path;

const MS_PER_MINUTE: i64 = 60_000;

pub async fn download_full_history(
    exchange: Exchange,
    category: MarketCategory,
    symbol: &str,
) -> Result<Vec<Candle>> {
    download_history(exchange, category, symbol, None).await
}

pub async fn download_history(
    exchange: Exchange,
    category: MarketCategory,
    symbol: &str,
    start_time: Option<i64>,
) -> Result<Vec<Candle>> {
    let mut all_candles = Vec::new();

    process_candle_batches(exchange, category, symbol, start_time, |candles| {
        all_candles.extend(candles);
        Ok(())
    })
    .await?;

    all_candles.sort_by_key(|c| c.timestamp);
    all_candles.dedup_by_key(|c| c.timestamp);

    Ok(all_candles)
}

pub async fn store_full_history(
    exchange: Exchange,
    category: MarketCategory,
    symbol: &str,
    base_dir: impl AsRef<Path>,
) -> Result<()> {
    store_history(exchange, category, symbol, None, base_dir).await
}

pub async fn store_history(
    exchange: Exchange,
    category: MarketCategory,
    symbol: &str,
    start_time: Option<i64>,
    base_dir: impl AsRef<Path>,
) -> Result<()> {
    let base = base_dir.as_ref();

    let mut buffer: Vec<Candle> = Vec::new();
    const FLUSH_THRESHOLD: usize = 100_000;

    process_candle_batches(exchange, category, symbol, start_time, |candles| {
        buffer.extend(candles);

        if buffer.len() >= FLUSH_THRESHOLD {
            buffer.sort_by_key(|c| c.timestamp);
            write_candles_partitioned(
                &buffer,
                exchange.as_str(),
                category.as_str(),
                symbol,
                "1min",
                base,
            )?;
            buffer.clear();
        }

        Ok(())
    })
    .await?;

    // flush remaining
    if !buffer.is_empty() {
        buffer.sort_by_key(|c| c.timestamp);
        write_candles_partitioned(
            &buffer,
            exchange.as_str(),
            category.as_str(),
            symbol,
            "1min",
            base,
        )?;
    }

    Ok(())
}

/// Private helper: runs the full pagination logic and calls `batch_processor`
/// for every batch of candles returned by the exchange.
async fn process_candle_batches<F>(
    exchange: Exchange,
    category: MarketCategory,
    symbol: &str,
    start_time: Option<i64>,
    mut batch_processor: F,
) -> Result<()>
where
    F: FnMut(Vec<Candle>) -> Result<()>,
{
    let start_time = match start_time {
        Some(ts) => floor_to_minute_start(ts),
        None => get_earliest_candle_timestamp(exchange.clone(), symbol, category.clone()).await?,
    };
    let end_time = Utc::now().timestamp_millis();

    let max_limit = exchange.max_candles_per_request();
    let ranges = get_1min_ranges(start_time, end_time, max_limit);
    let client = exchange.client(category);

    for range in ranges {
        let req = CandlesRequest {
            symbol: symbol.to_string(),
            interval: Interval::Minute(1),
            start_time: Some(range.start),
            end_time: Some(range.end),
            limit: Some(max_limit as u32),
        };
        println!("{:?}", range.start);

        let candles = client.get_candles(req).await?;

        batch_processor(candles)?;

        // polite rate limiting
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }

    Ok(())
}

/// Each range is guaranteed to be <= max_candles_per_request wide and perfectly aligned.
pub fn get_1min_ranges(
    start_time: i64,
    end_time: i64,
    max_candles_per_request: usize,
) -> Vec<DateRange> {
    if start_time >= end_time || max_candles_per_request == 0 {
        return vec![];
    }

    let mut ranges = Vec::new();
    let mut current = floor_to_minute_start(start_time);

    let chunk_ms = ((max_candles_per_request as i64).saturating_sub(1)) * MS_PER_MINUTE;

    while current < end_time {
        let chunk_end = (current + chunk_ms).min(end_time);
        ranges.push(DateRange {
            start: current,
            end: chunk_end,
        });
        current = chunk_end + MS_PER_MINUTE;
    }

    ranges
}

/// find the earliest candle by using binary search
pub async fn get_earliest_candle_timestamp(
    exchange: Exchange,
    symbol: &str,
    category: MarketCategory,
) -> Result<i64> {
    let client = exchange.client(category);

    let mut left: i64 = 0;
    let mut right = floor_to_minute_start(Utc::now().timestamp_millis());

    let mut candidate: Option<i64> = None;

    while left < right {
        let mid = floor_to_minute_start((left + right) / 2);

        let req = CandlesRequest {
            symbol: symbol.to_string(),
            interval: Interval::Minute(1),
            start_time: Some(mid),
            end_time: Some(mid),
            limit: None,
        };

        let candles = client.get_candles(req).await?;
        if candles.is_empty() {
            left = mid + MS_PER_MINUTE;
        } else {
            right = mid;
            candidate = candles.first().map(|c| c.timestamp);
        }

        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }

    match candidate {
        Some(ts) => Ok(ts),
        None => Err(Error::NoEarliestCandle(symbol.to_string())),
    }
}

/// Floors a timestamp (ms) to the start of the minute (00 seconds).
fn floor_to_minute_start(ts_ms: i64) -> i64 {
    (ts_ms / MS_PER_MINUTE) * MS_PER_MINUTE
}

#[derive(Debug, Clone, Copy)]
pub struct DateRange {
    pub start: i64,
    pub end: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parquet::load_candles;

    #[tokio::test]
    async fn test_download_full_history() -> Result<()> {
        let candles =
            download_full_history(Exchange::Bybit, MarketCategory::Spot, "BTCUSDT").await?;

        println!("Downloaded {} candles", candles.len());
        assert!(!candles.is_empty());
        Ok(())
    }

    #[tokio::test(flavor = "multi_thread")] // required for Polars Parquet writes
    async fn test_store_full_history() -> Result<()> {
        let temp_dir = tempfile::tempdir()?;

        // Only download the last 7 days for the test → very fast
        let seven_days_ago = Utc::now().timestamp_millis() - MS_PER_MINUTE * 1440 * 7;

        store_history(
            Exchange::Bybit,
            MarketCategory::Spot,
            "BTCUSDT",
            Some(seven_days_ago),
            temp_dir.path(),
        )
        .await?;

        let data_exists = temp_dir.path().join("bybit/spot/BTCUSDT/1min").exists();

        assert!(
            data_exists,
            "Parquet files were not written to the expected Hive structure"
        );

        Ok(())
    }

    #[tokio::test]
    async fn test_get_first_candle() -> Result<()> {
        let first_candle =
            get_earliest_candle_timestamp(Exchange::Bybit, "BTCUSDT", MarketCategory::Spot).await?;

        println!("{first_candle:?}");

        Ok(())
    }

    #[tokio::test(flavor = "multi_thread")] // required for Polars Parquet writes
    async fn test_load_candles() -> Result<()> {
        let exchange = Exchange::Bybit;
        let category = MarketCategory::Spot;
        let symbol = "BTCUSDT";

        let temp_dir = tempfile::tempdir()?;

        // Only download the last 7 days for the test → very fast
        let last_candle_ts = floor_to_minute_start(Utc::now().timestamp_millis());
        let seven_days_ago = floor_to_minute_start(last_candle_ts - MS_PER_MINUTE * 1440 * 7);

        store_history(
            exchange,
            category,
            symbol,
            Some(seven_days_ago),
            temp_dir.path(),
        )
        .await?;

        let data_exists = temp_dir.path().join("bybit/spot/BTCUSDT/1min").exists();

        assert!(
            data_exists,
            "Parquet files were not written to the expected Hive structure"
        );

        // Now load some stored candles
        let candles = tokio::task::spawn_blocking(move || {
            load_candles(
                temp_dir.path(),
                exchange.as_str(),
                category.as_str(),
                symbol,
                "1min",
                Some(last_candle_ts - MS_PER_MINUTE),
                Some(last_candle_ts),
                None,
            )
        })
        .await??;

        println!("Loaded {} candles from parquet", candles.len());
        assert!(!candles.is_empty(), "Candles not loaded from parquet files");

        print!("{candles:?}");

        Ok(())
    }
}
