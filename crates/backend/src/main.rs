pub mod catalog;
pub mod config;
pub mod handlers;
pub mod jobs;
pub mod models;
pub mod router;
pub mod services;
pub mod state;

use crate::jobs::{context::JobContext, queue::JobQueue, types::Job, worker::run_worker};
use anyhow::Result;
use config::Config;
use state::AppState;
use tokio::{net::TcpListener, sync::mpsc};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,axum=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::load()?;
    let catalog = crate::catalog::init(&config).await?;

    let (job_tx, job_rx) = mpsc::channel::<(Uuid, Job)>(32);
    let job_queue = JobQueue::new(job_tx);

    let ctx = JobContext {
        parquet_base_dir: config.parquet_base_dir(),
        catalog: catalog.clone(),
        job_queue: job_queue.clone(),
    };

    let state = AppState {
        config,
        job_queue,
        catalog,
    };

    // Spawn worker
    tokio::spawn(run_worker(job_rx, ctx));

    let app = router::create_router(state.clone());

    let addr = format!("{}:{}", state.config.server.host, state.config.server.port);
    let listener = TcpListener::bind(&addr).await?;

    tracing::info!("🚀 Backend listening on {}", &addr);

    axum::serve(listener, app).await?;

    Ok(())
}
