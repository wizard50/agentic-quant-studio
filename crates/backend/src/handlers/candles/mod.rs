use crate::models::candle::CandleQuery;
use crate::services::candle_service;
use anyhow::Result;
use axum::{Json, extract::Query, http::StatusCode};
use common::types::Candle;

pub async fn list(Query(query): Query<CandleQuery>) -> Result<Json<Vec<Candle>>, StatusCode> {
    let candles = tokio::task::spawn_blocking(move || candle_service::get_candles(query))
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
