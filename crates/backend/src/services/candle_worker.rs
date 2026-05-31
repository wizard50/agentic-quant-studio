use crate::catalog::Catalog;
use crate::services::jobs::ingest_candles::{IngestCandlesJob, JobStatus, Status};
use dashmap::DashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info};
use uuid::Uuid;
use warehouse::{candle_downloader, parquet};

pub async fn candle_ingestion_worker(
    mut rx: mpsc::Receiver<IngestCandlesJob>,
    status_map: Arc<DashMap<Uuid, JobStatus>>,
    base_dir: PathBuf,
    catalog: Catalog,
) {
    while let Some(job) = rx.recv().await {
        let job_id = job.id;

        // Mark as Running (lightweight operation, safe to do on async thread)
        if let Some(mut entry) = status_map.get_mut(&job_id) {
            entry.value_mut().status = Status::Running;
        }

        info!(
            job_id = %job_id,
            exchange = ?job.exchange,
            symbol = %job.symbol,
            "Starting candle ingestion"
        );

        let status_map = status_map.clone();
        let base_dir = base_dir.clone();
        let catalog = catalog.clone();
        let base_dir_for_refresh = base_dir.clone();

        // Run the heavy blocking parts (Parquet scanning + writing) on the blocking pool.
        // The download loop itself stays async.
        let result = tokio::task::spawn_blocking(move || {
            let rt = tokio::runtime::Handle::current();
            rt.block_on(async move {
                let from = determine_effective_start(&job, &base_dir).await;
                execute_ingestion(&job, from, &base_dir).await
            })
        })
        .await
        .map_err(warehouse::error::Error::Join)
        .and_then(|r| r);

        update_job_status(&status_map, job_id, result);

        // Hook: refresh the catalog after a successful ingestion
        // (catalog.refresh already uses spawn_blocking internally)
        if let Some(entry) = status_map.get(&job_id) {
            if matches!(entry.status, Status::Completed) {
                if let Err(e) = catalog.refresh(&base_dir_for_refresh).await {
                    error!("Failed to refresh catalog after successful ingestion: {}", e);
                }
            }
        }
    }
}

async fn determine_effective_start(job: &IngestCandlesJob, base_dir: &PathBuf) -> Option<i64> {
    if let Some(from) = job.from {
        return Some(from.timestamp_millis());
    }

    // Offload the blocking Parquet metadata scan
    let base_dir = base_dir.clone();
    let exchange = job.exchange.as_str().to_string();
    let category = job.category.as_str().to_string();
    let symbol = job.symbol.clone();

    tokio::task::spawn_blocking(move || {
        match parquet::last_candle_timestamp_in_parquet(
            &base_dir,
            &exchange,
            &category,
            &symbol,
            "1min",
        ) {
            Ok(from) => from,
            Err(_) => None,
        }
    })
    .await
    .ok()
    .flatten()
}

async fn execute_ingestion(
    job: &IngestCandlesJob,
    from: Option<i64>,
    base_dir: &PathBuf,
) -> Result<(), warehouse::error::Error> {
    if let Some(from_ts) = from {
        info!(job_id = %job.id, from = %from_ts, "Incremental ingestion");
        candle_downloader::store_history(
            job.exchange,
            job.category,
            &job.symbol,
            Some(from_ts),
            base_dir.clone(),
        )
        .await
    } else {
        info!(job_id = %job.id, "Full history ingestion");
        candle_downloader::store_full_history(
            job.exchange,
            job.category,
            &job.symbol,
            base_dir.clone(),
        )
        .await
    }
}

fn update_job_status(
    status_map: &DashMap<Uuid, JobStatus>,
    job_id: Uuid,
    result: Result<(), warehouse::error::Error>,
) {
    if let Some(mut entry) = status_map.get_mut(&job_id) {
        let status_entry = entry.value_mut();
        status_entry.finished_at = Some(chrono::Utc::now());

        match result {
            Ok(_) => {
                status_entry.status = Status::Completed;
                info!(job_id = %job_id, "Candle ingestion completed successfully");
            }
            Err(e) => {
                status_entry.status = Status::Failed;
                status_entry.error = Some(e.to_string());
                error!(job_id = %job_id, error = %e, "Candle ingestion failed");
            }
        }
    }
}
