use crate::jobs::types::JobRecord;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Default, Deserialize)]
pub struct JobQuery {
    pub kind: Option<String>,
    pub status: Option<String>,
    pub limit: Option<u32>,
    pub active: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct JobCreateResponse {
    pub job_id: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct JobInfo {
    pub id: Uuid,
    pub kind: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

impl From<JobRecord> for JobInfo {
    fn from(record: JobRecord) -> Self {
        Self {
            id: record.id,
            kind: record.job.kind().to_string(),
            status: record.status.to_string(),
            created_at: record.created_at,
            started_at: record.started_at,
            finished_at: record.finished_at,
            error: record.error,
        }
    }
}
