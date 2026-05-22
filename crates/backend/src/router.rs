use crate::config::Config;
use crate::handlers::candles;
use axum::{
    Router,
    http::{HeaderValue, StatusCode},
    routing::get,
};
use std::time::Duration;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, timeout::TimeoutLayer, trace::TraceLayer};

pub fn create_router(config: &Config) -> Router {
    let cors_layer = if config.cors.allowed_origins.contains(&"*".to_string()) {
        CorsLayer::permissive()
    } else {
        // Convert Vec<String> → Vec<HeaderValue> for allow_origin()
        let origins: Vec<HeaderValue> = config
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
            Duration::from_secs(10),
        ))
        .layer(cors_layer);

    Router::new()
        .nest("/api/v1", api_routes())
        .layer(middleware)
}

fn api_routes() -> Router {
    Router::new().route("/candles", get(candles::list))
}
