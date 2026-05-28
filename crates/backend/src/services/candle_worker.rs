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
) {
    while let Some(job) = rx.recv().await {
        let job_id = job.id;

        // Mark as Running
        if let Some(mut entry) = status_map.get_mut(&job_id) {
            entry.value_mut().status = Status::Running;
        }

        info!(
            job_id = %job_id,
            exchange = ?job.exchange,
            symbol = %job.symbol,
            "Starting candle ingestion"
        );

        let from = determine_effective_start(&job, &base_dir);

        let result = execute_ingestion(&job, from, &base_dir).await;

        update_job_status(&status_map, job_id, result);
    }
}

fn determine_effective_start(job: &IngestCandlesJob, base_dir: &PathBuf) -> Option<i64> {
    if let Some(from) = job.from {
        return Some(from.timestamp_millis());
    }

    // Try to find the last candle we already have
    match parquet::last_candle_timestamp_in_parquet(
        base_dir,
        job.exchange.as_str(),
        job.category.as_str(),
        &job.symbol,
        "1min",
    ) {
        Ok(from) => from,
        Err(_) => None,
    }
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
