use super::processors;
use crate::jobs::{context::JobContext, types::Job};
use tokio::sync::mpsc;
use tracing::{error, info};
use uuid::Uuid;

pub async fn run_worker(mut job_rx: mpsc::Receiver<(Uuid, Job)>, ctx: JobContext) {
    while let Some((job_id, job)) = job_rx.recv().await {
        match job {
            Job::IngestCandles(payload) => {
                // Mark as running
                ctx.job_queue.mark_running(job_id).await;

                let result = processors::ingest_candles::handle(&payload, &ctx, job_id).await;

                match result {
                    Ok(_) => {
                        info!(job_id = %job_id, "Candle ingestion completed successfully");
                        ctx.job_queue.mark_completed(job_id).await
                    }
                    Err(e) => {
                        error!(job_id = %job_id, error = %e, "Candle ingestion failed");
                        ctx.job_queue.mark_failed(job_id, e.to_string()).await
                    }
                }
            }
        }
    }
}
