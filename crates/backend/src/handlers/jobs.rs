use crate::jobs::types::Job;
use crate::models::job::{JobCreateResponse, JobInfo, JobQuery};
use crate::state::AppState;
use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
};
use uuid::Uuid;

pub async fn list_jobs(
    State(state): State<AppState>,
    Query(query): Query<JobQuery>,
) -> Result<Json<Vec<JobInfo>>, StatusCode> {
    Ok(Json(
        state
            .job_queue
            .filter(query)
            .into_iter()
            .map(Into::into)
            .collect(),
    ))
}

pub async fn create_job(
    State(state): State<AppState>,
    Json(job): Json<Job>,
) -> Result<(StatusCode, Json<JobCreateResponse>), StatusCode> {
    // check for duplicates
    if let Some(existing_id) = state.job_queue.find_active_job(&job) {
        return Ok((
            StatusCode::CONFLICT,
            Json(JobCreateResponse {
                job_id: existing_id.to_string(),
                status: "Job already queued".to_string(),
            }),
        ));
    }

    // add new job
    let job_id = match state.job_queue.enqueue(job).await {
        Ok(id) => id,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    Ok((
        StatusCode::ACCEPTED,
        Json(JobCreateResponse {
            job_id: job_id.to_string(),
            status: "Job queued".to_string(),
        }),
    ))
}

pub async fn get_job(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<JobInfo>, StatusCode> {
    match state.job_queue.get(job_id) {
        Some(record) => Ok(Json(record.into())),
        None => Err(StatusCode::NOT_FOUND),
    }
}
