use crate::models::candle::{CandleIngestRequest, CandleIngestResponse, CandleQuery};
use crate::services::candle_service;
use crate::services::jobs::ingest_candles::{IngestCandlesJob, JobStatus, Status};
use crate::state::AppState;
use anyhow::Result;
use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use chrono::Utc;
use common::types::{Candle, Interval};

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
