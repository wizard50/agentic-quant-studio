use crate::{models::catalog::IndicatorCatalogResponse, state::AppState};
use axum::{Json, extract::State, http::StatusCode};
use studio::registry::builtin_registry;
use warehouse::catalog::CatalogSnapshot;

pub async fn candles(State(state): State<AppState>) -> Result<Json<CatalogSnapshot>, StatusCode> {
    let snapshot = state.catalog.get_candles().await;
    Ok(Json(snapshot))
}

pub async fn indicators() -> Json<IndicatorCatalogResponse> {
    let registry = builtin_registry();
    Json(IndicatorCatalogResponse::from_registry(&registry))
}

/// Triggers a background refresh of the candle catalog.
///
/// Returns 202 Accepted immediately. The actual scan runs in the background
/// (similar to how the candle worker runs, but as a simple spawned task rather
/// than a tracked job with status).
pub async fn refresh_candles(State(state): State<AppState>) -> StatusCode {
    let base_dir = state.config.parquet_base_dir();
    let catalog = state.catalog.clone();

    // Fire-and-forget the refresh
    tokio::spawn(async move {
        if let Err(e) = catalog.refresh(&base_dir).await {
            tracing::error!("Background catalog refresh failed: {}", e);
        } else {
            tracing::info!("Background catalog refresh completed");
        }
    });

    StatusCode::ACCEPTED
}
