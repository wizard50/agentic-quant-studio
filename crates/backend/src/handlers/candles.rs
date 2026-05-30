use crate::models::candle::{CandleIngestRequest, CandleIngestResponse, CandleQuery};
use crate::models::job::{IngestJob, IngestJobListQuery};
use crate::services::candle_service;
use crate::services::jobs::ingest_candles::{IngestCandlesJob, JobStatus, Status};
use crate::state::AppState;
use anyhow::Result;
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::Utc;
use common::types::{Candle, Interval};
use uuid::Uuid;

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<CandleQuery>,
) -> Result<Json<Vec<Candle>>, StatusCode> {
    let candles =
        tokio::task::spawn_blocking(move || candle_service::get_candles(&state.config, query))
            .await
            .map_err(|join_err| {
                tracing::error!("Blocking task failed: {}", join_err);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .map_err(|e| {
                tracing::error!("Failed to load candles: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(candles))
}

pub async fn ingest(
    State(state): State<AppState>,
    Query(request): Query<CandleIngestRequest>,
) -> Result<(StatusCode, Json<CandleIngestResponse>), StatusCode> {
    let job = IngestCandlesJob::new(
        request.exchange,
        request.category,
        request.symbol,
        Interval::Minute(1),
        None,
        None,
    );
    let job_key = job.key();
    let job_id = job.id.clone();

    // Duplicate check
    if let Some(existing_id) = state.find_active_job(&job_key) {
        return Ok((
            StatusCode::CONFLICT,
            Json(CandleIngestResponse {
                job_id: existing_id.to_string(),
                status: "Job already queued".to_string(),
            }),
        ));
    }

    // Insert status BEFORE sending
    state.job_status.insert(
        job.id,
        JobStatus {
            key: job_key,
            status: Status::Pending,
            created_at: Utc::now(),
            finished_at: None,
            error: None,
        },
    );

    // Send to worker
    if state.job_queue.send(job).await.is_err() {
        // Channel closed → remove status and fail
        state.job_status.remove(&job_id);
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    Ok((
        StatusCode::ACCEPTED,
        Json(CandleIngestResponse {
            job_id: job_id.to_string(),
            status: "Job queued".to_string(),
        }),
    ))
}

// Job status endpoints

/// List candle ingestion jobs.
///
/// Supports optional filtering by status and limiting the result set.
pub async fn list_ingest_jobs(
    State(state): State<AppState>,
    Query(query): Query<IngestJobListQuery>,
) -> Result<Json<Vec<IngestJob>>, StatusCode> {
    let limit = query.limit.unwrap_or(100).min(500) as usize;

    // Parse status filter if provided (e.g. "pending,running")
    let allowed_statuses: Option<Vec<String>> = query.status.as_ref().map(|s| {
        s.split(',')
            .map(|part| part.trim().to_lowercase())
            .filter(|p| !p.is_empty())
            .collect()
    });

    let active_only = query.active.unwrap_or(false);

    let mut jobs: Vec<IngestJob> = state
        .job_status
        .iter()
        .filter_map(|entry| {
            let id = *entry.key();
            let status = entry.value();

            // Apply active filter
            if active_only {
                let is_active = matches!(status.status, Status::Pending | Status::Running);
                if !is_active {
                    return None;
                }
            }

            // Apply status filter
            if let Some(ref allowed) = allowed_statuses {
                let current = status.status.as_str();
                if !allowed.contains(&current.to_string()) {
                    return None;
                }
            }

            Some(IngestJob::from_status(id, status))
        })
        .collect();

    // Sort newest first
    jobs.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    // Apply limit
    jobs.truncate(limit);

    Ok(Json(jobs))
}

/// Get the status of a single ingestion job by ID.
pub async fn get_ingest_job(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<IngestJob>, StatusCode> {
    match state.job_status.get(&job_id) {
        Some(entry) => {
            let job = IngestJob::from_status(job_id, entry.value());
            Ok(Json(job))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}
