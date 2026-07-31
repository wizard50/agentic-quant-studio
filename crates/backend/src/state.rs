use crate::catalog::Catalog;
use crate::config::Config;
use crate::jobs::queue::JobQueue;
use crate::services::StudyStore;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub job_queue: JobQueue,
    pub catalog: Catalog,
    pub study_store: StudyStore,
}
