use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use studio::presentation::compile_presentation;
use studio::registry::builtin_registry;
use studio::runtime::validate;
use studio::spec::GraphSpec;
use tracing::warn;

use crate::{
    models::studio::{
        CreateStudyRequest, ListStudiesQuery, Study, StudyStatus, UpdateStudyRequest,
    },
    services::StudyStoreError,
    state::AppState,
};

use super::studio::{log_studio_error, studio_error_status};

pub async fn list_studies(
    State(state): State<AppState>,
    Query(query): Query<ListStudiesQuery>,
) -> Json<Vec<Study>> {
    let statuses = query.statuses();
    Json(state.study_store.list(&statuses))
}

pub async fn get_study(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Study>, StatusCode> {
    state
        .study_store
        .get(&id)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

/// Create a draft study from a full graph body.
pub async fn create_study(
    State(state): State<AppState>,
    Json(request): Json<CreateStudyRequest>,
) -> Result<(StatusCode, Json<Study>), StatusCode> {
    let registry = builtin_registry();
    let presentation = validate_and_compile(&request.graph, &registry)?;

    let study = state.study_store.create_draft(
        request.graph,
        presentation,
        request.title,
        request.created_by,
        request.presentation_overrides,
    );

    Ok((StatusCode::CREATED, Json(study)))
}

/// Update a draft (`graph` / title / overrides) and/or accept (`status: applied`).
pub async fn update_study(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(request): Json<UpdateStudyRequest>,
) -> Result<Json<Study>, StatusCode> {
    let registry = builtin_registry();

    let wants_content = request.graph.is_some()
        || request.title.is_some()
        || request.presentation_overrides.is_some()
        || request.expected_version.is_some();
    let wants_accept = matches!(request.status, Some(StudyStatus::Applied));

    if !wants_content && !wants_accept {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Some(status) = request.status {
        if status != StudyStatus::Applied {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    if wants_content {
        let existing = state.study_store.get(&id).ok_or(StatusCode::NOT_FOUND)?;

        if existing.status != StudyStatus::Draft {
            return Err(map_store_error(StudyStoreError::InvalidStatus {
                actual: existing.status,
            }));
        }

        let graph = request.graph.unwrap_or_else(|| existing.graph.clone());
        let presentation = validate_and_compile(&graph, &registry)?;

        state
            .study_store
            .update_draft(
                &id,
                graph,
                presentation,
                request.title,
                request.presentation_overrides,
                request.expected_version,
            )
            .map_err(map_store_error)?;
    }

    if wants_accept {
        let existing = state.study_store.get(&id).ok_or(StatusCode::NOT_FOUND)?;

        // Re-validate graph; presentation already stored.
        validate(&existing.graph, &registry).map_err(|err| {
            log_studio_error(&existing.graph.id, &err);
            studio_error_status(&err)
        })?;

        let study = state.study_store.accept(&id).map_err(map_store_error)?;
        return Ok(Json(study));
    }

    state
        .study_store
        .get(&id)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn delete_study(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    state.study_store.delete(&id).map_err(map_store_error)?;
    Ok(StatusCode::NO_CONTENT)
}

fn validate_and_compile(
    graph: &GraphSpec,
    registry: &studio::registry::NodeRegistry,
) -> Result<studio::presentation::PresentationSpec, StatusCode> {
    validate(graph, registry).map_err(|err| {
        log_studio_error(&graph.id, &err);
        studio_error_status(&err)
    })?;
    compile_presentation(graph, registry).map_err(|err| {
        log_studio_error(&graph.id, &err);
        studio_error_status(&err)
    })
}

fn map_store_error(err: StudyStoreError) -> StatusCode {
    match err {
        StudyStoreError::NotFound => StatusCode::NOT_FOUND,
        StudyStoreError::VersionConflict { expected, actual } => {
            warn!(expected, actual, "Study version conflict");
            StatusCode::CONFLICT
        }
        StudyStoreError::InvalidStatus { actual } => {
            warn!(
                status = actual.as_str(),
                "Study operation invalid for status"
            );
            StatusCode::CONFLICT
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::StudyStore;
    use studio::spec::{GraphKind, GraphSpec, NodeSpec};

    #[test]
    fn create_rejects_invalid_graph_without_storing() {
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

        assert!(validate(&graph, &builtin_registry()).is_err());
        assert!(store.list(&[]).is_empty());
    }

    #[test]
    fn draft_accept_roundtrip() {
        let store = StudyStore::new();
        let graph: GraphSpec = serde_json::from_str(GOLDEN_CROSS_JSON).unwrap();
        validate(&graph, &builtin_registry()).unwrap();

        let presentation = compile_presentation(&graph, &builtin_registry()).unwrap();
        let draft = store.create_draft(graph.clone(), presentation, None, None, None);
        let applied = store.accept(&draft.id).unwrap();
        assert_eq!(applied.status, StudyStatus::Applied);
        assert_eq!(store.get(&draft.id).unwrap().graph.nodes.len(), 4);
        // golden cross: main pane only, markers for cross
        let stored = store.get(&draft.id).unwrap();
        assert_eq!(stored.presentation.panes.len(), 1);
        assert!(
            stored
                .presentation
                .outputs
                .iter()
                .any(|p| p == "cross.signal")
        );
    }

    #[test]
    fn compile_rsi_reclaim_presentation_for_study() {
        let graph: GraphSpec = serde_json::from_str(RSI_RECLAIM_JSON).unwrap();
        validate(&graph, &builtin_registry()).unwrap();
        let presentation = compile_presentation(&graph, &builtin_registry()).unwrap();

        assert_eq!(
            presentation
                .panes
                .iter()
                .map(|p| p.id.as_str())
                .collect::<Vec<_>>(),
            vec!["main", "rsi14"]
        );
        let rsi = presentation.panes.iter().find(|p| p.id == "rsi14").unwrap();
        let layer_ids: Vec<_> = rsi.layers.iter().map(|l| l.id.as_str()).collect();
        assert_eq!(layer_ids, vec!["rsi14", "level30", "reclaim"]);
        assert!(presentation.outputs.iter().any(|o| o == "reclaim.signal"));

        let store = StudyStore::new();
        let study = store.create_draft(
            graph,
            presentation.clone(),
            Some("RSI reclaim".into()),
            None,
            None,
        );
        assert_eq!(study.presentation.panes.len(), 2);
        assert_eq!(store.get(&study.id).unwrap().presentation, presentation);
    }

    #[test]
    fn compile_rejects_graph_without_candles_datasource() {
        let graph = GraphSpec {
            id: "no-ds".to_string(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![NodeSpec {
                id: "sma20".to_string(),
                kind: "indicator.sma".to_string(),
                params: serde_json::json!({ "period": 20 }),
            }],
            edges: vec![],
        };
        // validate may pass unknown structure with known kinds; compile requires candles
        let err = compile_presentation(&graph, &builtin_registry()).unwrap_err();
        assert!(matches!(
            err,
            studio::error::Error::MissingCandlesDatasource
        ));
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

    const RSI_RECLAIM_JSON: &str = r#"
{
  "id": "rsi-reclaim",
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
    { "id": "rsi14", "kind": "indicator.rsi", "params": { "period": 14 } },
    { "id": "sma20", "kind": "indicator.sma", "params": { "period": 20 } },
    { "id": "level30", "kind": "literal.number", "params": { "value": 30 } },
    { "id": "reclaim", "kind": "logic.crossover", "params": {} }
  ],
  "edges": [
    { "from": "ds1.close", "to": "rsi14.input" },
    { "from": "ds1.close", "to": "sma20.input" },
    { "from": "ds1.timestamp", "to": "level30.reference" },
    { "from": "rsi14.value", "to": "reclaim.fast" },
    { "from": "level30.value", "to": "reclaim.slow" }
  ]
}
"#;
}
