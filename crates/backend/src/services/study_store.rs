use chrono::Utc;
use dashmap::DashMap;
use std::sync::Arc;
use studio::spec::GraphSpec;
use uuid::Uuid;

use crate::models::studio::{Study, StudyCreatedBy, StudyStatus};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StudyStoreError {
    NotFound,
    VersionConflict {
        expected: u64,
        actual: u64,
    },
    /// Operation not allowed for the study's current status.
    InvalidStatus {
        actual: StudyStatus,
    },
}

/// In-memory flat study registry (draft / applied / archived).
///
/// Lost on process restart (same durability model as the job queue).
/// At most one study may be `applied` at a time.
#[derive(Clone, Default)]
pub struct StudyStore {
    studies: Arc<DashMap<String, Study>>,
}

impl StudyStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, id: &str) -> Option<Study> {
        self.studies.get(id).map(|entry| entry.value().clone())
    }

    /// List studies filtered by status, newest `updated_at` first.
    pub fn list(&self, statuses: &[StudyStatus]) -> Vec<Study> {
        let mut items: Vec<Study> = self
            .studies
            .iter()
            .filter(|entry| statuses.is_empty() || statuses.contains(&entry.value().status))
            .map(|entry| entry.value().clone())
            .collect();

        items.sort_by(|a, b| {
            b.updated_at
                .cmp(&a.updated_at)
                .then_with(|| b.id.cmp(&a.id))
        });
        items
    }

    pub fn create_draft(
        &self,
        graph: GraphSpec,
        title: Option<String>,
        created_by: Option<StudyCreatedBy>,
        presentation_overrides: Option<serde_json::Value>,
    ) -> Study {
        let study = Study {
            id: Uuid::new_v4().to_string(),
            status: StudyStatus::Draft,
            version: 1,
            updated_at: Utc::now(),
            graph,
            title,
            created_by,
            presentation_overrides,
        };
        self.studies.insert(study.id.clone(), study.clone());
        study
    }

    pub fn update_draft(
        &self,
        id: &str,
        graph: GraphSpec,
        title: Option<String>,
        presentation_overrides: Option<serde_json::Value>,
        expected_version: Option<u64>,
    ) -> Result<Study, StudyStoreError> {
        let mut entry = self.studies.get_mut(id).ok_or(StudyStoreError::NotFound)?;

        if entry.status != StudyStatus::Draft {
            return Err(StudyStoreError::InvalidStatus {
                actual: entry.status,
            });
        }

        if let Some(expected) = expected_version {
            if entry.version != expected {
                return Err(StudyStoreError::VersionConflict {
                    expected,
                    actual: entry.version,
                });
            }
        }

        entry.graph = graph;
        if title.is_some() {
            entry.title = title;
        }
        entry.presentation_overrides = presentation_overrides;
        entry.version += 1;
        entry.updated_at = Utc::now();

        Ok(entry.clone())
    }

    /// Promote a draft to applied. Previous applied (if any) becomes archived.
    pub fn accept(&self, id: &str) -> Result<Study, StudyStoreError> {
        // Snapshot status first so we don't hold a DashMap guard across later get_mut calls.
        let status = self.get(id).ok_or(StudyStoreError::NotFound)?.status;
        if status != StudyStatus::Draft {
            return Err(StudyStoreError::InvalidStatus { actual: status });
        }

        let now = Utc::now();

        // Demote any other applied study (at most one in practice).
        let previous_applied: Vec<String> = self
            .studies
            .iter()
            .filter(|e| e.value().status == StudyStatus::Applied && e.key() != id)
            .map(|e| e.key().clone())
            .collect();
        for prev_id in previous_applied {
            if let Some(mut prev) = self.studies.get_mut(&prev_id) {
                prev.status = StudyStatus::Archived;
                prev.updated_at = now;
            }
        }

        let mut entry = self.studies.get_mut(id).ok_or(StudyStoreError::NotFound)?;
        entry.status = StudyStatus::Applied;
        entry.version += 1;
        entry.updated_at = now;
        Ok(entry.clone())
    }

    pub fn delete(&self, id: &str) -> Result<(), StudyStoreError> {
        let status = self
            .studies
            .get(id)
            .map(|e| e.status)
            .ok_or(StudyStoreError::NotFound)?;

        if status == StudyStatus::Applied {
            return Err(StudyStoreError::InvalidStatus { actual: status });
        }

        self.studies.remove(id);
        Ok(())
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
    fn create_draft_sets_version_one() {
        let store = StudyStore::new();
        let study = store.create_draft(
            sample_graph("g1"),
            Some("t".into()),
            Some(StudyCreatedBy::Agent),
            None,
        );

        assert_eq!(study.status, StudyStatus::Draft);
        assert_eq!(study.version, 1);
        assert_eq!(study.graph.id, "g1");
        assert_eq!(study.created_by, Some(StudyCreatedBy::Agent));
        assert!(store.get(&study.id).is_some());
    }

    #[test]
    fn list_filters_and_orders() {
        let store = StudyStore::new();
        let d1 = store.create_draft(sample_graph("a"), None, None, None);
        let d2 = store.create_draft(sample_graph("b"), None, None, None);
        store.accept(&d1.id).unwrap();

        let drafts = store.list(&[StudyStatus::Draft]);
        assert_eq!(drafts.len(), 1);
        assert_eq!(drafts[0].id, d2.id);

        let applied = store.list(&[StudyStatus::Applied]);
        assert_eq!(applied.len(), 1);
        assert_eq!(applied[0].id, d1.id);
    }

    #[test]
    fn update_draft_increments_version() {
        let store = StudyStore::new();
        let study = store.create_draft(sample_graph("g1"), None, None, None);

        let updated = store
            .update_draft(
                &study.id,
                sample_graph("g2"),
                Some("n".into()),
                None,
                Some(1),
            )
            .unwrap();

        assert_eq!(updated.version, 2);
        assert_eq!(updated.graph.id, "g2");
        assert_eq!(updated.title.as_deref(), Some("n"));
    }

    #[test]
    fn update_draft_version_conflict() {
        let store = StudyStore::new();
        let study = store.create_draft(sample_graph("g1"), None, None, None);

        let err = store
            .update_draft(&study.id, sample_graph("g2"), None, None, Some(99))
            .unwrap_err();

        assert_eq!(
            err,
            StudyStoreError::VersionConflict {
                expected: 99,
                actual: 1
            }
        );
        assert_eq!(store.get(&study.id).unwrap().graph.id, "g1");
    }

    #[test]
    fn update_applied_is_invalid_status() {
        let store = StudyStore::new();
        let study = store.create_draft(sample_graph("g1"), None, None, None);
        store.accept(&study.id).unwrap();

        let err = store
            .update_draft(&study.id, sample_graph("g2"), None, None, None)
            .unwrap_err();
        assert_eq!(
            err,
            StudyStoreError::InvalidStatus {
                actual: StudyStatus::Applied
            }
        );
    }

    #[test]
    fn accept_archives_previous_applied() {
        let store = StudyStore::new();
        let first = store.create_draft(sample_graph("g1"), None, None, None);
        store.accept(&first.id).unwrap();

        let second = store.create_draft(sample_graph("g2"), None, None, None);
        let accepted = store.accept(&second.id).unwrap();

        assert_eq!(accepted.status, StudyStatus::Applied);
        assert_eq!(store.get(&first.id).unwrap().status, StudyStatus::Archived);
        assert_eq!(store.list(&[StudyStatus::Applied]).len(), 1);
    }

    #[test]
    fn accept_non_draft_fails() {
        let store = StudyStore::new();
        let study = store.create_draft(sample_graph("g1"), None, None, None);
        store.accept(&study.id).unwrap();

        let err = store.accept(&study.id).unwrap_err();
        assert_eq!(
            err,
            StudyStoreError::InvalidStatus {
                actual: StudyStatus::Applied
            }
        );
    }

    #[test]
    fn delete_draft_ok_applied_fails() {
        let store = StudyStore::new();
        let draft = store.create_draft(sample_graph("g1"), None, None, None);
        store.delete(&draft.id).unwrap();
        assert!(store.get(&draft.id).is_none());

        let applied = store.create_draft(sample_graph("g2"), None, None, None);
        store.accept(&applied.id).unwrap();
        let err = store.delete(&applied.id).unwrap_err();
        assert_eq!(
            err,
            StudyStoreError::InvalidStatus {
                actual: StudyStatus::Applied
            }
        );
    }

    #[test]
    fn delete_archived_ok() {
        let store = StudyStore::new();
        let first = store.create_draft(sample_graph("g1"), None, None, None);
        store.accept(&first.id).unwrap();
        let second = store.create_draft(sample_graph("g2"), None, None, None);
        store.accept(&second.id).unwrap();

        assert_eq!(store.get(&first.id).unwrap().status, StudyStatus::Archived);
        store.delete(&first.id).unwrap();
        assert!(store.get(&first.id).is_none());
    }
}
