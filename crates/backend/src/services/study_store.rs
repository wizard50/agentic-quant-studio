use chrono::Utc;
use dashmap::{DashMap, mapref::entry::Entry};
use std::sync::Arc;
use studio::spec::GraphSpec;

use crate::models::studio::StudyDocument;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StudyStoreError {
    VersionConflict { expected: u64, actual: u64 },
}

/// In-memory study store: one latest study per workspace.
///
/// Lost on process restart (same durability model as the job queue).
#[derive(Clone, Default)]
pub struct StudyStore {
    studies: Arc<DashMap<String, StudyDocument>>,
}

impl StudyStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, workspace_id: &str) -> Option<StudyDocument> {
        self.studies
            .get(workspace_id)
            .map(|entry| entry.value().clone())
    }

    /// Insert or replace a validated study for `workspace_id`.
    ///
    /// Path `workspace_id` is the source of truth (not taken from the body).
    /// `version` starts at 1 and increments on each successful apply.
    pub fn apply(
        &self,
        workspace_id: &str,
        graph: GraphSpec,
        presentation_overrides: Option<serde_json::Value>,
        expected_version: Option<u64>,
    ) -> Result<StudyDocument, StudyStoreError> {
        match self.studies.entry(workspace_id.to_string()) {
            Entry::Occupied(mut entry) => {
                let prev = entry.get();
                if let Some(expected) = expected_version {
                    if prev.version != expected {
                        return Err(StudyStoreError::VersionConflict {
                            expected,
                            actual: prev.version,
                        });
                    }
                }

                let doc = StudyDocument {
                    workspace_id: workspace_id.to_string(),
                    version: prev.version + 1,
                    updated_at: Utc::now(),
                    graph,
                    presentation_overrides,
                };
                entry.insert(doc.clone());
                Ok(doc)
            }
            Entry::Vacant(entry) => {
                if let Some(expected) = expected_version {
                    // No study yet — only accept unconditional create, or expected 0 if we
                    // ever use that. For first apply, expected_version must be absent or we
                    // treat mismatch as conflict against "no document" (actual 0).
                    if expected != 0 {
                        return Err(StudyStoreError::VersionConflict {
                            expected,
                            actual: 0,
                        });
                    }
                }

                let doc = StudyDocument {
                    workspace_id: workspace_id.to_string(),
                    version: 1,
                    updated_at: Utc::now(),
                    graph,
                    presentation_overrides,
                };
                entry.insert(doc.clone());
                Ok(doc)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use studio::spec::GraphKind;

    fn sample_graph(id: &str) -> GraphSpec {
        GraphSpec {
            id: id.to_string(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![],
            edges: vec![],
        }
    }

    #[test]
    fn first_apply_sets_version_one() {
        let store = StudyStore::new();
        let doc = store.apply("ws-a", sample_graph("g1"), None, None).unwrap();

        assert_eq!(doc.workspace_id, "ws-a");
        assert_eq!(doc.version, 1);
        assert_eq!(doc.graph.id, "g1");
        assert!(doc.presentation_overrides.is_none());
    }

    #[test]
    fn second_apply_increments_version() {
        let store = StudyStore::new();
        let first = store.apply("ws-a", sample_graph("g1"), None, None).unwrap();
        let second = store
            .apply(
                "ws-a",
                sample_graph("g2"),
                Some(serde_json::json!({})),
                None,
            )
            .unwrap();

        assert_eq!(first.version, 1);
        assert_eq!(second.version, 2);
        assert_eq!(second.graph.id, "g2");
        assert!(second.updated_at >= first.updated_at);
        assert_eq!(second.presentation_overrides, Some(serde_json::json!({})));
    }

    #[test]
    fn get_returns_latest() {
        let store = StudyStore::new();
        assert!(store.get("missing").is_none());

        store.apply("ws-a", sample_graph("g1"), None, None).unwrap();
        let got = store.get("ws-a").unwrap();
        assert_eq!(got.version, 1);
        assert_eq!(got.graph.id, "g1");
    }

    #[test]
    fn expected_version_mismatch_is_conflict() {
        let store = StudyStore::new();
        store.apply("ws-a", sample_graph("g1"), None, None).unwrap();

        let err = store
            .apply("ws-a", sample_graph("g2"), None, Some(99))
            .unwrap_err();

        assert_eq!(
            err,
            StudyStoreError::VersionConflict {
                expected: 99,
                actual: 1
            }
        );
        // Previous document unchanged
        assert_eq!(store.get("ws-a").unwrap().graph.id, "g1");
        assert_eq!(store.get("ws-a").unwrap().version, 1);
    }

    #[test]
    fn expected_version_match_allows_apply() {
        let store = StudyStore::new();
        store.apply("ws-a", sample_graph("g1"), None, None).unwrap();

        let doc = store
            .apply("ws-a", sample_graph("g2"), None, Some(1))
            .unwrap();
        assert_eq!(doc.version, 2);
        assert_eq!(doc.graph.id, "g2");
    }

    #[test]
    fn expected_version_on_empty_store_conflicts_unless_zero() {
        let store = StudyStore::new();
        let err = store
            .apply("ws-a", sample_graph("g1"), None, Some(1))
            .unwrap_err();
        assert_eq!(
            err,
            StudyStoreError::VersionConflict {
                expected: 1,
                actual: 0
            }
        );

        let doc = store
            .apply("ws-a", sample_graph("g1"), None, Some(0))
            .unwrap();
        assert_eq!(doc.version, 1);
    }

    #[test]
    fn invalid_graph_not_the_store_concern() {
        // Store accepts any GraphSpec; validate-on-write is the handler's job.
        // This documents the boundary: store only versions and replaces.
        let store = StudyStore::new();
        let bad = GraphSpec {
            id: "bad".to_string(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![studio::spec::NodeSpec {
                id: "n1".to_string(),
                kind: "nope.thing".to_string(),
                params: serde_json::json!({}),
            }],
            edges: vec![],
        };
        let doc = store.apply("ws", bad, None, None).unwrap();
        assert_eq!(doc.graph.nodes[0].kind, "nope.thing");
    }
}
