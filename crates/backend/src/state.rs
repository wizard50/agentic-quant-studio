use crate::catalog::Catalog;
use crate::config::Config;
use crate::jobs::queue::JobQueue;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub job_queue: JobQueue,
    pub catalog: Catalog,
}
