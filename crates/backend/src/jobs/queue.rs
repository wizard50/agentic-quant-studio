use crate::jobs::types::{Job, JobRecord, JobStatus};
use crate::models::job::JobQuery;
use chrono::Utc;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

#[derive(Clone)]
pub struct JobQueue {
    queue: Sender<(Uuid, Job)>,
    status: Arc<DashMap<Uuid, JobRecord>>,
}

impl JobQueue {
    pub fn new(sender: Sender<(Uuid, Job)>) -> Self {
        Self {
            queue: sender,
            status: Arc::new(DashMap::new()),
        }
    }

    pub async fn enqueue(&self, job: Job) -> anyhow::Result<Uuid> {
        // Guard against duplicates
        if let Some(existing_id) = self.find_active_job(&job) {
            return Err(anyhow::anyhow!(
                "job already active (existing_id={})",
                existing_id
            ));
        }

        let job_id = Uuid::new_v4();

        let job_record = JobRecord {
            id: job_id,
            status: JobStatus::Pending,
            created_at: Utc::now(),
            started_at: None,
            finished_at: None,
            error: None,
            job: job.clone(),
        };

        self.status.insert(job_id, job_record);

        // remove the job info when sending failed
        if self.queue.send((job_id, job)).await.is_err() {
            self.status.remove(&job_id);
        }

        Ok(job_id)
    }

    pub fn find_active_job(&self, job: &Job) -> Option<Uuid> {
        let signature = job.signature();
        self.status.iter().find_map(|entry| {
            let record = entry.value();
            if record.job.signature() == signature
                && matches!(record.status, JobStatus::Pending | JobStatus::Running)
            {
                Some(record.id)
            } else {
                None
            }
        })
    }

    pub fn is_active(&self, job: Job) -> bool {
        self.find_active_job(&job).is_some()
    }

    pub fn get(&self, job_id: Uuid) -> Option<JobRecord> {
        self.status.get(&job_id).map(|entry| entry.value().clone())
    }

    pub fn filter(&self, query: JobQuery) -> Vec<JobRecord> {
        let limit = query.limit.unwrap_or(100).min(500) as usize;

        // Parse status filter if provided (e.g. "pending,running")
        let allowed_statuses: Option<Vec<String>> = query.status.as_ref().map(|s| {
            s.split(',')
                .map(|part| part.trim().to_lowercase())
                .filter(|p| !p.is_empty())
                .collect()
        });

        let active_only = query.active.unwrap_or(false);

        let mut jobs: Vec<JobRecord> = self
            .status
            .iter()
            .filter_map(|entry| {
                let job_record = entry.value().clone();

                // Apply kind filter
                if let Some(kind) = &query.kind
                    && job_record.job.kind() != kind
                {
                    return None;
                }

                // Apply active filter
                if active_only
                    && !matches!(job_record.status, JobStatus::Pending | JobStatus::Running)
                {
                    return None;
                }

                // Apply status filter
                if let Some(ref allowed) = allowed_statuses {
                    let current = job_record.status.to_string();
                    if !allowed.contains(&current) {
                        return None;
                    }
                }

                Some(job_record)
            })
            .collect();

        // Sort newest first
        jobs.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        // Apply limit
        jobs.truncate(limit);

        return jobs;
    }

    pub async fn mark_running(&self, job_id: Uuid) {
        if let Some(mut entry) = self.status.get_mut(&job_id) {
            entry.started_at = Some(Utc::now());
            entry.status = JobStatus::Running;
        }
    }

    pub async fn mark_completed(&self, job_id: Uuid) {
        if let Some(mut entry) = self.status.get_mut(&job_id) {
            entry.finished_at = Some(Utc::now());
            entry.status = JobStatus::Completed;
        }
    }

    pub async fn mark_failed(&self, job_id: Uuid, error: String) {
        if let Some(mut entry) = self.status.get_mut(&job_id) {
            entry.finished_at = Some(Utc::now());
            entry.status = JobStatus::Failed;
            entry.error = Some(error);
        }
    }
}
