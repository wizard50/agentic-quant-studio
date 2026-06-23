use std::sync::Arc;

use axum::{Json, extract::State, http::StatusCode};
use studio::{
    error::Error,
    registry::builtin_registry,
    runtime::{ExecutionContext, execute},
    spec::GraphSpec,
};
use tracing::warn;

use crate::{models::studio::StudioRunResponse, services::WarehouseCandleSource, state::AppState};

pub async fn run_graph(
    State(state): State<AppState>,
    Json(graph): Json<GraphSpec>,
) -> Result<Json<StudioRunResponse>, StatusCode> {
    let catalog = state.catalog.get_candles().await;
    let ctx = ExecutionContext::new(Arc::new(WarehouseCandleSource::new(
        Arc::new(state.config.clone()),
        catalog,
    )));
    let registry = builtin_registry();

    let store = execute(&graph, &registry, &ctx).await.map_err(|err| {
        log_studio_error(&graph.id, &err);
        studio_error_status(&err)
    })?;

    Ok(Json(StudioRunResponse::from_store(store)))
}

fn studio_error_status(err: &Error) -> StatusCode {
    match err {
        Error::DataSource(message) if message == "candle dataset not found" => {
            StatusCode::NOT_FOUND
        }
        Error::InvalidParameter(_)
        | Error::ParamNotFound(_)
        | Error::UnknownKind(_)
        | Error::InvalidFormat
        | Error::Empty
        | Error::ContainsDot => StatusCode::BAD_REQUEST,
        Error::NodeNotFound(_)
        | Error::PortNotFound(_)
        | Error::DuplicateNodeId(_)
        | Error::DuplicateInputWire(_)
        | Error::CycleDetected
        | Error::PortTypeMismatch { .. }
        | Error::TypeMismatch { .. }
        | Error::Indicator(_) => StatusCode::UNPROCESSABLE_ENTITY,
        Error::DataSource(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

fn log_studio_error(graph_id: &str, err: &Error) {
    match studio_error_status(err) {
        StatusCode::BAD_REQUEST | StatusCode::NOT_FOUND | StatusCode::UNPROCESSABLE_ENTITY => {
            warn!(graph_id, error = %err, "Studio graph run failed");
        }
        _ => {
            tracing::error!(graph_id, error = %err, "Studio graph run failed");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_dataset_not_found_to_404() {
        let status =
            studio_error_status(&Error::DataSource("candle dataset not found".to_string()));
        assert_eq!(status, StatusCode::NOT_FOUND);
    }

    #[test]
    fn maps_cycle_to_422() {
        let status = studio_error_status(&Error::CycleDetected);
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    }
}
