use std::path::PathBuf;

use crate::catalog::Catalog;
use crate::jobs::queue::JobQueue;

pub struct JobContext {
    pub parquet_base_dir: PathBuf,
    pub catalog: Catalog,
    pub job_queue: JobQueue,
}
