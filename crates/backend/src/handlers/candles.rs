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
    let request_for_log = request.clone();
    let catalog = state.catalog.get_candles().await;
    let config = state.config.clone();

    let candles = tokio::task::spawn_blocking(move || {
        candle_service::get_candles(&config, &catalog, request)
    })
    .await
    .map_err(|join_err| {
        tracing::error!("Blocking task failed: {}", join_err);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .map_err(|e| match e {
        warehouse::error::Error::DatasetNotFound => {
            tracing::warn!("Candle dataset not found: {:?}", request_for_log);
            StatusCode::NOT_FOUND
        }
        warehouse::error::Error::InvalidCandleQuery(message) => {
            tracing::warn!("Invalid candle query: {} ({:?})", message, request_for_log);
            StatusCode::BAD_REQUEST
        }
        other => {
            tracing::error!("Failed to load candles: {}", other);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    })?;

    Ok(Json(candles))
}
