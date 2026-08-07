use std::{
    collections::{HashMap, HashSet},
    str::FromStr,
};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use studio::{
    error::Error,
    presentation::PresentationSpec,
    runtime::{PortStore, Value},
    spec::{GraphSpec, PortRef},
};

#[derive(Debug, Deserialize)]
pub struct StudioRunRequest {
    pub graph: GraphSpec,
    pub outputs: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StudyStatus {
    Draft,
    Applied,
    Archived,
}

impl StudyStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Applied => "applied",
            Self::Archived => "archived",
        }
    }
}

impl FromStr for StudyStatus {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim() {
            "draft" => Ok(Self::Draft),
            "applied" => Ok(Self::Applied),
            "archived" => Ok(Self::Archived),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StudyCreatedBy {
    User,
    Agent,
}

/// Flat study document (draft, applied, or archived).
///
/// `version` is the study revision for concurrency — not `graph.version`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Study {
    pub id: String,
    pub status: StudyStatus,
    pub version: u64,
    pub updated_at: DateTime<Utc>,
    pub graph: GraphSpec,
    /// Derived chart layout from `compile_presentation` (not agent-authored).
    pub presentation: PresentationSpec,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by: Option<StudyCreatedBy>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presentation_overrides: Option<serde_json::Value>,
}

/// Create a draft study (always `status: draft`).
#[derive(Debug, Deserialize)]
pub struct CreateStudyRequest {
    pub graph: GraphSpec,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub created_by: Option<StudyCreatedBy>,
    #[serde(default)]
    pub presentation_overrides: Option<serde_json::Value>,
}

/// Update a draft and/or promote it: set `status` to `applied` to accept.
#[derive(Debug, Deserialize)]
pub struct UpdateStudyRequest {
    #[serde(default)]
    pub graph: Option<GraphSpec>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub presentation_overrides: Option<serde_json::Value>,
    #[serde(default)]
    pub expected_version: Option<u64>,
    /// Set to `applied` to accept this draft (archives the previous applied study).
    #[serde(default)]
    pub status: Option<StudyStatus>,
}

#[derive(Debug, Default, Deserialize)]
pub struct ListStudiesQuery {
    /// Comma-separated statuses, e.g. `draft,applied`. Default: draft+applied (not archived).
    pub status: Option<String>,
}

impl ListStudiesQuery {
    pub fn statuses(&self) -> Vec<StudyStatus> {
        match &self.status {
            None => vec![StudyStatus::Draft, StudyStatus::Applied],
            Some(raw) if raw.trim().is_empty() => {
                vec![StudyStatus::Draft, StudyStatus::Applied]
            }
            Some(raw) => raw
                .split(',')
                .filter_map(|part| StudyStatus::from_str(part).ok())
                .collect(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ValidateStudyRequest {
    pub graph: GraphSpec,
}

#[derive(Debug, Serialize)]
pub struct ValidateStudyResponse {
    pub ok: bool,
}

/// Dry-run presentation compile (no persist). Same graph body shape as validate.
#[derive(Debug, Deserialize)]
pub struct CompilePresentationRequest {
    pub graph: GraphSpec,
}

#[derive(Debug, Serialize)]
pub struct StudioRunResponse {
    pub outputs: HashMap<String, Value>,
    pub meta: StudioRunMeta,
}

#[derive(Debug, Serialize)]
pub struct StudioRunMeta {
    pub graph_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<usize>,
}

impl StudioRunRequest {
    pub fn validate_outputs(&self) -> Result<(), Error> {
        if self.outputs.is_empty() {
            return Err(Error::InvalidParameter(
                "outputs must contain at least one port".to_string(),
            ));
        }

        let mut seen = HashSet::new();
        for port in &self.outputs {
            if !seen.insert(port) {
                return Err(Error::InvalidParameter(format!(
                    "duplicate output port: {port}"
                )));
            }
            PortRef::from_str(port)?;
        }

        Ok(())
    }
}

impl StudioRunResponse {
    pub fn from_store(
        store: &PortStore,
        requested: &[String],
        graph_id: &str,
    ) -> Result<Self, Error> {
        let mut outputs = HashMap::new();
        let mut length = None;

        for port_str in requested {
            let port = PortRef::from_str(port_str)?;
            let value = store.get(&port)?;
            if length.is_none() {
                length = series_length(value.as_ref());
            }
            outputs.insert(port_str.clone(), value.as_ref().clone());
        }

        Ok(Self {
            outputs,
            meta: StudioRunMeta {
                graph_id: graph_id.to_string(),
                length,
            },
        })
    }
}

fn series_length(value: &Value) -> Option<usize> {
    match value {
        Value::SeriesI64(series) => Some(series.values.len()),
        Value::SeriesF64(series) => Some(series.values.len()),
        Value::SeriesBool(series) => Some(series.values.len()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use studio::runtime::value::SeriesF64;

    #[test]
    fn request_deserializes_port_list() {
        let body: StudioRunRequest = serde_json::from_str(
            r#"{
            "graph": {
              "id": "ds-sma",
              "version": 1,
              "kind": "chart",
              "nodes": [],
              "edges": []
            },
            "outputs": ["ds1.close", "sma20.value"]
          }"#,
        )
        .unwrap();

        assert_eq!(body.outputs, vec!["ds1.close", "sma20.value"]);
    }

    #[test]
    fn request_rejects_empty_outputs() {
        let request = StudioRunRequest {
            graph: GraphSpec {
                id: "test".to_string(),
                version: 1,
                kind: studio::spec::GraphKind::Chart,
                nodes: vec![],
                edges: vec![],
            },
            outputs: vec![],
        };

        let err = request.validate_outputs().unwrap_err();
        assert!(matches!(err, Error::InvalidParameter(_)));
    }

    #[test]
    fn create_study_request_deserializes_optional_fields() {
        let body: CreateStudyRequest = serde_json::from_str(
            r#"{
            "graph": {
              "id": "ds-sma",
              "version": 1,
              "kind": "chart",
              "nodes": [],
              "edges": []
            }
          }"#,
        )
        .unwrap();

        assert!(body.title.is_none());
        assert!(body.created_by.is_none());
        assert_eq!(body.graph.id, "ds-sma");
    }

    #[test]
    fn update_study_request_status_only() {
        let body: UpdateStudyRequest = serde_json::from_str(r#"{ "status": "applied" }"#).unwrap();
        assert_eq!(body.status, Some(StudyStatus::Applied));
        assert!(body.graph.is_none());
    }

    #[test]
    fn study_serde_roundtrip() {
        let study = Study {
            id: "s1".to_string(),
            status: StudyStatus::Draft,
            version: 2,
            updated_at: Utc::now(),
            graph: GraphSpec {
                id: "g".to_string(),
                version: 1,
                kind: studio::spec::GraphKind::Chart,
                nodes: vec![],
                edges: vec![],
            },
            presentation: studio::presentation::PresentationSpec {
                version: 1,
                panes: vec![],
                outputs: vec![],
            },
            title: Some("Demo".to_string()),
            created_by: Some(StudyCreatedBy::Agent),
            presentation_overrides: Some(serde_json::json!({ "pane": "main" })),
        };

        let json = serde_json::to_string(&study).unwrap();
        let restored: Study = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.id, study.id);
        assert_eq!(restored.status, StudyStatus::Draft);
        assert_eq!(restored.version, study.version);
        assert_eq!(restored.graph.id, study.graph.id);
        assert_eq!(restored.created_by, Some(StudyCreatedBy::Agent));
    }

    #[test]
    fn list_query_default_statuses() {
        let q = ListStudiesQuery::default();
        assert_eq!(q.statuses(), vec![StudyStatus::Draft, StudyStatus::Applied]);
    }

    #[test]
    fn list_query_parses_status_filter() {
        let q = ListStudiesQuery {
            status: Some("draft,archived".to_string()),
        };
        assert_eq!(
            q.statuses(),
            vec![StudyStatus::Draft, StudyStatus::Archived]
        );
    }

    #[test]
    fn from_store_returns_requested_ports_only() {
        let mut store = PortStore::default();
        store.insert(
            PortRef::new("ds1", "close").unwrap(),
            Value::SeriesF64(Arc::new(SeriesF64 {
                values: vec![Some(1.0), Some(2.0)],
            })),
        );
        store.insert(
            PortRef::new("ds1", "open").unwrap(),
            Value::SeriesF64(Arc::new(SeriesF64 {
                values: vec![Some(3.0)],
            })),
        );

        let response =
            StudioRunResponse::from_store(&store, &["ds1.close".to_string()], "ds-sma").unwrap();

        assert_eq!(response.outputs.len(), 1);
        assert!(response.outputs.contains_key("ds1.close"));
        assert!(!response.outputs.contains_key("ds1.open"));
        assert_eq!(response.meta.graph_id, "ds-sma");
        assert_eq!(response.meta.length, Some(2));

        let json = serde_json::to_value(&response.outputs["ds1.close"]).unwrap();
        assert_eq!(json["kind"], "series_f64");
        assert!(json.get("label").is_none());
    }

    #[test]
    fn from_store_missing_port_returns_error() {
        let store = PortStore::default();
        let err = StudioRunResponse::from_store(&store, &["missing.port".to_string()], "test")
            .unwrap_err();

        assert!(matches!(err, Error::PortNotFound(_)));
    }
}
