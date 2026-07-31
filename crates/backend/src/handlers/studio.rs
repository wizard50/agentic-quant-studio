use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use studio::{
    error::Error,
    registry::builtin_registry,
    runtime::{ExecutionContext, execute, validate},
};
use tracing::{error, warn};

use crate::{
    models::studio::{
        ApplyStudyRequest, StudioRunRequest, StudioRunResponse, StudyDocument,
        ValidateStudyRequest, ValidateStudyResponse,
    },
    services::{StudyStoreError, WarehouseCandleSource},
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

/// Apply a validated study to a workspace (validate-on-write).
pub async fn apply_study(
    State(state): State<AppState>,
    Path(workspace_id): Path<String>,
    Json(request): Json<ApplyStudyRequest>,
) -> Result<Json<StudyDocument>, StatusCode> {
    validate_workspace_id(&workspace_id)?;

    let registry = builtin_registry();
    validate(&request.graph, &registry).map_err(|err| {
        log_studio_error(&request.graph.id, &err);
        studio_error_status(&err)
    })?;

    let document = state
        .study_store
        .apply(
            &workspace_id,
            request.graph,
            request.presentation_overrides,
            request.expected_version,
        )
        .map_err(|err| match err {
            StudyStoreError::VersionConflict { expected, actual } => {
                warn!(
                    workspace_id,
                    expected, actual, "Study apply version conflict"
                );
                StatusCode::CONFLICT
            }
        })?;

    Ok(Json(document))
}

/// Load the latest applied study for a workspace.
pub async fn get_study(
    State(state): State<AppState>,
    Path(workspace_id): Path<String>,
) -> Result<Json<StudyDocument>, StatusCode> {
    validate_workspace_id(&workspace_id)?;

    state
        .study_store
        .get(&workspace_id)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

fn validate_workspace_id(workspace_id: &str) -> Result<(), StatusCode> {
    if workspace_id.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(())
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
    use crate::services::StudyStore;
    use studio::spec::{GraphKind, GraphSpec, NodeSpec};

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
    fn empty_workspace_id_is_bad_request() {
        assert_eq!(validate_workspace_id(""), Err(StatusCode::BAD_REQUEST));
        assert_eq!(validate_workspace_id("   "), Err(StatusCode::BAD_REQUEST));
        assert!(validate_workspace_id("ws-1").is_ok());
    }

    #[test]
    fn apply_rejects_invalid_graph_without_storing() {
        let store = StudyStore::new();
        let graph = GraphSpec {
            id: "bad".to_string(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![NodeSpec {
                id: "n1".to_string(),
                kind: "nope.thing".to_string(),
                params: serde_json::json!({}),
            }],
            edges: vec![],
        };

        let err = validate(&graph, &builtin_registry()).unwrap_err();
        assert!(matches!(err, Error::UnknownKind(_)));
        // Simulate handler: only store after validate succeeds
        assert!(store.get("ws").is_none());
    }

    #[test]
    fn apply_roundtrip_via_store_after_validate() {
        let store = StudyStore::new();
        let graph: GraphSpec = serde_json::from_str(GOLDEN_CROSS_JSON).unwrap();
        validate(&graph, &builtin_registry()).unwrap();

        let doc = store.apply("ws-1", graph.clone(), None, None).unwrap();
        assert_eq!(doc.version, 1);

        let got = store.get("ws-1").unwrap();
        assert_eq!(got.version, 1);
        assert_eq!(got.graph.id, graph.id);
        assert_eq!(got.graph.nodes.len(), 4);
    }

    const GOLDEN_CROSS_JSON: &str = r#"
{
  "id": "golden-cross-btc-1d",
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
    { "id": "sma20", "kind": "indicator.sma", "params": { "period": 20 } },
    { "id": "sma50", "kind": "indicator.sma", "params": { "period": 50 } },
    { "id": "cross", "kind": "logic.crossover", "params": {} }
  ],
  "edges": [
    { "from": "ds1.close", "to": "sma20.input" },
    { "from": "ds1.close", "to": "sma50.input" },
    { "from": "sma20.value", "to": "cross.fast" },
    { "from": "sma50.value", "to": "cross.slow" }
  ]
}
"#;
}
