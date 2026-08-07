use std::sync::Arc;

use axum::{Json, extract::State, http::StatusCode};
use studio::{
    error::Error,
    presentation::{PresentationSpec, compile_presentation},
    registry::{NodeRegistry, builtin_registry},
    runtime::{ExecutionContext, execute, validate},
    spec::GraphSpec,
};
use tracing::{error, warn};

use crate::{
    models::studio::{
        CompilePresentationRequest, StudioRunRequest, StudioRunResponse, ValidateStudyRequest,
        ValidateStudyResponse,
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

/// Compile chart presentation from a graph without persisting (agent dry-run).
pub async fn compile_presentation_handler(
    Json(request): Json<CompilePresentationRequest>,
) -> Result<Json<PresentationSpec>, StatusCode> {
    let registry = builtin_registry();
    let presentation = validate_and_compile(&request.graph, &registry)?;
    Ok(Json(presentation))
}

/// Validate graph then derive presentation (shared by studies write path and dry-run).
pub(crate) fn validate_and_compile(
    graph: &GraphSpec,
    registry: &NodeRegistry,
) -> Result<PresentationSpec, StatusCode> {
    validate(graph, registry).map_err(|err| {
        log_studio_error(&graph.id, &err);
        studio_error_status(&err)
    })?;
    compile_presentation(graph, registry).map_err(|err| {
        log_studio_error(&graph.id, &err);
        studio_error_status(&err)
    })
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

    #[test]
    fn validate_and_compile_sma_produces_main_pane() {
        let graph: GraphSpec = serde_json::from_str(
            r#"{
              "id": "ds-sma",
              "version": 1,
              "kind": "chart",
              "nodes": [
                {
                  "id": "ds1",
                  "kind": "datasource.candles",
                  "params": {
                    "exchange": "bybit",
                    "category": "spot",
                    "symbol": "BTCUSDT",
                    "interval": "1d"
                  }
                },
                { "id": "sma20", "kind": "indicator.sma", "params": { "period": 20 } }
              ],
              "edges": [{ "from": "ds1.close", "to": "sma20.input" }]
            }"#,
        )
        .unwrap();
        let presentation = validate_and_compile(&graph, &builtin_registry()).unwrap();
        assert_eq!(presentation.panes.len(), 1);
        assert_eq!(presentation.panes[0].id, "main");
        assert!(presentation.outputs.iter().any(|o| o == "sma20.value"));
    }

    #[test]
    fn validate_and_compile_missing_candles_is_422_mapping() {
        let graph: GraphSpec = serde_json::from_str(
            r#"{
              "id": "no-ds",
              "version": 1,
              "kind": "chart",
              "nodes": [
                { "id": "sma20", "kind": "indicator.sma", "params": { "period": 20 } }
              ],
              "edges": []
            }"#,
        )
        .unwrap();
        // validate passes; compile fails → same status as MissingCandlesDatasource
        let err = studio::presentation::compile_presentation(&graph, &builtin_registry())
            .unwrap_err();
        assert_eq!(studio_error_status(&err), StatusCode::UNPROCESSABLE_ENTITY);
    }
}
