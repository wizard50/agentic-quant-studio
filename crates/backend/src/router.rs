use crate::handlers::candles;
use crate::state::AppState;
use axum::{
    Router,
    http::{HeaderValue, StatusCode},
    routing::{get, post},
};
use std::time::Duration;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, timeout::TimeoutLayer, trace::TraceLayer};

pub fn create_router(state: AppState) -> Router {
    let cors_layer = if state.config.cors.allowed_origins.contains(&"*".to_string()) {
        CorsLayer::permissive()
    } else {
        // Convert Vec<String> → Vec<HeaderValue> for allow_origin()
        let origins: Vec<HeaderValue> = state
            .config
            .cors
            .allowed_origins
            .iter()
            .filter_map(|origin| origin.parse().ok())
            .collect();

        CorsLayer::new().allow_origin(origins)
    };

    let middleware = ServiceBuilder::new()
        .layer(TraceLayer::new_for_http())
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(30),
        ))
        .layer(cors_layer);

    Router::new()
        .nest("/api/v1", api_routes())
        .layer(middleware)
        .with_state(state)
}

fn api_routes() -> Router<AppState> {
    Router::new()
        .route("/candles", get(candles::list))
        .route("/candles/ingest", post(candles::ingest))
    // .route("/candles/ingest/status", get(candles::ingest_status))
    // .route("/candles/ingest/jobs", get(candles::ingest_status))
}
