//! Catalog module — the "what data do we have" domain concept.
//!
//! This is intentionally its own module (not under services or models)
//! because "Catalog" is a core domain concept in this application.

use std::sync::Arc;
use tokio::sync::RwLock;
use warehouse::catalog::CatalogSnapshot;

#[derive(Clone)]
pub struct Catalog {
    pub candles: Arc<RwLock<CatalogSnapshot>>,
}

impl Catalog {
    /// Returns a clone of the current candle catalog snapshot.
    pub async fn get_candles(&self) -> CatalogSnapshot {
        self.candles.read().await.clone()
    }

    /// Rebuilds the catalog snapshot from disk and updates the in-memory view.
    ///
    /// This is intended to be called after new data has been written (e.g. after
    /// a successful ingestion). The expensive scanning work runs inside
    /// `spawn_blocking`.
    pub async fn refresh(&self, base_dir: impl AsRef<std::path::Path>) -> anyhow::Result<()> {
        let base_dir = base_dir.as_ref().to_path_buf();

        let new_snapshot = tokio::task::spawn_blocking(move || -> Result<_, anyhow::Error> {
            tracing::info!("Refreshing candle catalog from {:?}", base_dir);

            // After an ingestion we always want a fresh scan (don't rely on stale catalog.json)
            let snap = warehouse::catalog::build_snapshot(&base_dir)?;
            // Persist so that future restarts are fast
            if let Err(e) = warehouse::catalog::save_to_file(&base_dir, &snap) {
                tracing::warn!("Failed to write catalog.json during refresh: {}", e);
            }
            Ok(snap)
        })
        .await??;

        {
            let mut guard = self.candles.write().await;
            *guard = new_snapshot;
        }

        tracing::info!("Catalog refresh completed successfully");
        Ok(())
    }
}

/// Initializes the catalog (loads from `catalog.json` if present, otherwise scans).
///
/// The heavy work (directory walking + Parquet metadata scanning via Polars)
/// is done inside `spawn_blocking` to avoid blocking the async runtime.
pub async fn init(config: &crate::config::Config) -> anyhow::Result<Catalog> {
    let base_dir = config.parquet_base_dir();

    let snapshot = tokio::task::spawn_blocking(move || -> Result<_, anyhow::Error> {
        if let Ok(Some(snap)) = warehouse::catalog::load_from_file(&base_dir) {
            tracing::info!(
                "Loaded candle catalog from disk ({} datasets)",
                snap.datasets.len()
            );
            Ok(snap)
        } else {
            tracing::info!("Building fresh candle catalog from {:?}", base_dir);
            let snap = warehouse::catalog::build_snapshot(&base_dir)?;
            warehouse::catalog::save_to_file(&base_dir, &snap)?;
            Ok(snap)
        }
    })
    .await??;

    Ok(Catalog {
        candles: Arc::new(RwLock::new(snapshot)),
    })
}
