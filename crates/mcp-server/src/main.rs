//! Agentic Quant Studio MCP server (stdio).
//!
//! Talks to the backend HTTP API only. Log to stderr — stdout is the MCP channel.

mod client;
mod server;

use anyhow::Result;
use client::BackendClient;
use rmcp::{ServiceExt, transport::stdio};
use server::AqsMcpServer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,mcp_server=info".into()),
        )
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(std::io::stderr)
                .with_target(true),
        )
        .init();

    let client = BackendClient::from_env();
    tracing::info!(backend = %client.base_url(), "starting aqs-mcp (stdio)");

    let service = AqsMcpServer::new(client)
        .serve(stdio())
        .await
        .map_err(|e| anyhow::anyhow!("MCP serve failed: {e}"))?;

    service
        .waiting()
        .await
        .map_err(|e| anyhow::anyhow!("MCP wait failed: {e}"))?;

    Ok(())
}
