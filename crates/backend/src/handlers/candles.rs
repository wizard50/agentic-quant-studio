use crate::models::candle::{CandleLoad, CandlePathParams, CandleQueryParams};
use crate::services::candle_service;
use crate::state::AppState;
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use common::types::Candle;

pub async fn list(
    State(state): State<AppState>,
    Path(path): Path<CandlePathParams>,
    Query(query): Query<CandleQueryParams>,
) -> Result<Json<Vec<Candle>>, StatusCode> {
    let request = CandleLoad::new(path, query);

    let candles =
        tokio::task::spawn_blocking(move || candle_service::get_candles(&state.config, request))
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
