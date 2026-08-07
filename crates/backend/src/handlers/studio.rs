use std::sync::Arc;

use axum::{Json, extract::State, http::StatusCode};
use studio::{
    error::Error,
    registry::builtin_registry,
    runtime::{ExecutionContext, execute, validate},
};
use tracing::{error, warn};

use crate::{
    models::studio::{
        StudioRunRequest, StudioRunResponse, ValidateStudyRequest, ValidateStudyResponse,
    },
    services::WarehouseCandleSource,
    state::AppState,
};

pub async fn run_graph(
    State(state): State<AppState>,
    Json(request): Json<StudioRunRequest>,
) -> Result<Json<StudioRunResponse>, StatusCode> {
    request.validate_outputs().map_err(|err| {
        log_studio_error(&request.graph.id, &err);
        studio_error_status(&err)
    })?;

    let catalog = state.catalog.get_candles().await;
    let ctx = ExecutionContext::new(Arc::new(WarehouseCandleSource::new(
        Arc::new(state.config.clone()),
        catalog,
    )));
    let registry = builtin_registry();
    let graph_id = request.graph.id.clone();

    let store = execute(&request.graph, &registry, &ctx)
        .await
        .map_err(|err| {
            log_studio_error(&graph_id, &err);
            studio_error_status(&err)
        })?;

    let response =
        StudioRunResponse::from_store(&store, &request.outputs, &graph_id).map_err(|err| {
            log_studio_error(&graph_id, &err);
            studio_error_status(&err)
        })?;

    Ok(Json(response))
}

/// Validate a graph without persisting (agent dry-run).
pub async fn validate_graph(
    Json(request): Json<ValidateStudyRequest>,
) -> Result<Json<ValidateStudyResponse>, StatusCode> {
    let registry = builtin_registry();
    validate(&request.graph, &registry).map_err(|err| {
        log_studio_error(&request.graph.id, &err);
        studio_error_status(&err)
    })?;

    Ok(Json(ValidateStudyResponse { ok: true }))
}

pub(crate) fn studio_error_status(err: &Error) -> StatusCode {
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
        | Error::Indicator(_)
        | Error::MissingCandlesDatasource => StatusCode::UNPROCESSABLE_ENTITY,
        Error::DataSource(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

pub(crate) fn log_studio_error(graph_id: &str, err: &Error) {
    match studio_error_status(err) {
        StatusCode::BAD_REQUEST | StatusCode::NOT_FOUND | StatusCode::UNPROCESSABLE_ENTITY => {
            warn!(graph_id, error = %err, "Studio graph operation failed");
        }
        _ => {
            error!(graph_id, error = %err, "Studio graph operation failed");
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

    #[test]
    fn maps_missing_output_port_to_422() {
        let status = studio_error_status(&Error::PortNotFound("sma20.value".to_string()));
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[test]
    fn maps_unknown_kind_to_400() {
        let status = studio_error_status(&Error::UnknownKind("nope.thing".to_string()));
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
}
