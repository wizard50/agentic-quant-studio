use crate::catalog::Catalog;
use crate::config::Config;
use crate::services::jobs::ingest_candles::{IngestCandlesJob, JobKey, JobStatus, Status};
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

/// Shared application state injected into every Axum handler
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub job_queue: mpsc::Sender<IngestCandlesJob>,
    pub job_status: Arc<DashMap<Uuid, JobStatus>>,
    pub catalog: Catalog,
}

impl AppState {
    pub fn find_active_job(&self, key: &JobKey) -> Option<Uuid> {
        self.job_status
            .iter()
            .find(|entry| {
                &entry.value().key == key
                    && matches!(entry.value().status, Status::Pending | Status::Running)
            })
            .map(|entry| *entry.key())
    }
}
