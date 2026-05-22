use anyhow::Result;
use chrono::Utc;
use common::types::*;
use std::path::PathBuf;
use warehouse::candle_downloader::store_history;

const MS_PER_MINUTE: i64 = 60_000;

fn floor_to_minute_start(ts_ms: i64) -> i64 {
    (ts_ms / MS_PER_MINUTE) * MS_PER_MINUTE
}

fn get_parquet_base_dir() -> PathBuf {
    let path = std::env::var("AGENTIC_QUANT_PARQUET_BASE_DIR")
        .unwrap_or_else(|_| "/tmp/agentic-quant/parquet".to_string());
    shellexpand::tilde(&path).into_owned().into()
}

#[tokio::main]
async fn main() -> Result<()> {
    let exchange = Exchange::Bybit;
    let category = MarketCategory::Spot;
    let symbol = "BTCUSDT";

    let last_candle_ts = floor_to_minute_start(Utc::now().timestamp_millis());
    let seven_days_ago = floor_to_minute_start(last_candle_ts - MS_PER_MINUTE * 1440 * 7);

    println!(
        "🚀 Seeding initial data for {}/{}/{} (last 7 days only)...",
        exchange, category, symbol
    );

    let parquet_base_dir = get_parquet_base_dir();

    store_history(
        exchange,
        category,
        symbol,
        Some(seven_days_ago),
        parquet_base_dir,
    )
    .await?;

    println!("✅ Initial data seeded successfully!");
    Ok(())
}
