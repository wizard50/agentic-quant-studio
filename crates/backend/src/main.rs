pub mod config;
pub mod handlers;
pub mod models;
pub mod router;
pub mod services;
pub mod state;

use crate::services::{
    candle_worker::candle_ingestion_worker, jobs::ingest_candles::IngestCandlesJob,
};
use anyhow::Result;
use config::Config;
use dashmap::DashMap;
use state::AppState;
use std::sync::Arc;
use tokio::{net::TcpListener, sync::mpsc};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

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

    let (job_tx, job_rx) = mpsc::channel::<IngestCandlesJob>(32);

    let state = AppState {
        config,
        job_queue: job_tx,
        job_status: Arc::new(DashMap::new()),
    };

    // Spawn worker
    tokio::spawn(candle_ingestion_worker(
        job_rx,
        state.job_status.clone(),
        state.config.parquet_base_dir(),
    ));

    let app = router::create_router(state.clone());

    let addr = format!("{}:{}", state.config.server.host, state.config.server.port);
    let listener = TcpListener::bind(&addr).await?;

    tracing::info!("🚀 Backend listening on {}", &addr);

    axum::serve(listener, app).await?;

    Ok(())
}
