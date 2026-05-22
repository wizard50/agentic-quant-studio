pub mod config;
pub mod handlers;
pub mod models;
pub mod router;
pub mod services;

use anyhow::Result;
use config::Config;
use tokio::net::TcpListener;
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

    let app = router::create_router(&config);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = TcpListener::bind(&addr).await?;

    tracing::info!("🚀 Backend listening on {}", &addr);

    axum::serve(listener, app).await?;

    Ok(())
}
