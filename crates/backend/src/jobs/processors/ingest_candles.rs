use crate::jobs::context::JobContext;
use crate::jobs::types::IngestCandlesPayload;
use crate::services::candle_service;
use anyhow::Result;
use std::path::PathBuf;
use tracing::error;
use uuid::Uuid;
use warehouse::parquet;

pub async fn handle(payload: &IngestCandlesPayload, ctx: &JobContext, job_id: Uuid) -> Result<()> {
    let from = determine_effective_start(payload, &ctx.parquet_base_dir).await;
    let _ = candle_service::execute_ingestion(payload, from, &ctx.parquet_base_dir, job_id).await;

    if let Err(e) = ctx.catalog.refresh(&ctx.parquet_base_dir).await {
        error!(
            "Failed to refresh catalog after successful ingestion: {}",
            e
        );
    }

    Ok(())
}

async fn determine_effective_start(
    payload: &IngestCandlesPayload,
    base_dir: &PathBuf,
) -> Option<i64> {
    // Offload the blocking Parquet metadata scan
    let base_dir = base_dir.clone();
    let exchange = payload.exchange.as_str().to_string();
    let category = payload.category.as_str().to_string();
    let symbol = payload.symbol.clone();

    tokio::task::spawn_blocking(move || {
        match parquet::last_candle_timestamp_in_parquet(
            &base_dir, &exchange, &category, &symbol, "1min",
        ) {
            Ok(from) => from,
            Err(_) => None,
        }
    })
    .await
    .ok()
    .flatten()
}
