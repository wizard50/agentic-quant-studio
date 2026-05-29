//! Simple, file-based catalog for the warehouse.
//!
//! This module provides the ability to discover what datasets currently exist
//! on disk (by scanning the Hive-partitioned Parquet layout) and to persist
//! a lightweight snapshot to `catalog.json`.

use crate::error::{Error, Result};
use chrono::{DateTime, Utc};
use polars::prelude::*;
use polars_utils::pl_path::PlRefPath;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const CATALOG_FILE_NAME: &str = "catalog.json";
pub const CATALOG_VERSION: u32 = 1;

/// Represents coverage information for one dataset in the warehouse.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetCoverage {
    pub exchange: String,
    pub category: String,
    pub symbol: String,
    pub interval: String,
    /// Earliest timestamp (milliseconds since epoch).
    pub from: i64,
    /// Latest timestamp (milliseconds since epoch).
    pub to: i64,
    pub record_count: u64,
    pub approx_size_bytes: u64,
    pub last_updated: DateTime<Utc>,
}

/// A point-in-time snapshot of everything known about the warehouse contents.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogSnapshot {
    pub version: u32,
    pub generated_at: DateTime<Utc>,
    pub datasets: Vec<DatasetCoverage>,
}

/// Build a fresh catalog snapshot by scanning the on-disk Hive layout.
///
/// This is the primary entry point for discovery. It walks the expected
/// directory structure and, for every dataset root that contains Parquet data,
/// computes min/max/count using Parquet statistics (no full data load) plus
/// approximate on-disk size.
pub fn build_snapshot(base_dir: &Path) -> Result<CatalogSnapshot> {
    let base = base_dir.to_path_buf();
    if !base.exists() {
        return Ok(empty_snapshot());
    }

    let dataset_roots = discover_dataset_roots(&base)?;
    let mut datasets = Vec::with_capacity(dataset_roots.len());

    for root in dataset_roots {
        if let Some(coverage) = compute_coverage_for_dataset(&root, &base)? {
            datasets.push(coverage);
        }
    }

    Ok(CatalogSnapshot {
        version: CATALOG_VERSION,
        generated_at: Utc::now(),
        datasets,
    })
}

/// Load an existing catalog snapshot from disk, if present.
///
/// Returns `Ok(None)` if the file does not exist (not an error).
/// Returns an error only on I/O or deserialization failures.
pub fn load_from_file(base_dir: &Path) -> Result<Option<CatalogSnapshot>> {
    let path = base_dir.join(CATALOG_FILE_NAME);
    if !path.exists() {
        return Ok(None);
    }

    let bytes = fs::read(&path).map_err(|e| {
        Error::CatalogPersistence(format!("failed to read {}: {}", path.display(), e))
    })?;

    let snapshot: CatalogSnapshot = serde_json::from_slice(&bytes).map_err(|e| {
        Error::CatalogPersistence(format!("failed to deserialize {}: {}", path.display(), e))
    })?;

    Ok(Some(snapshot))
}

/// Persist a catalog snapshot to `catalog.json` inside `base_dir`.
///
/// The file is written atomically enough for our purposes (write to temp + rename
/// is left as a future improvement if needed).
pub fn save_to_file(base_dir: &Path, snapshot: &CatalogSnapshot) -> Result<()> {
    let path = base_dir.join(CATALOG_FILE_NAME);

    // Ensure parent exists (the parquet base dir should, but be defensive).
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            Error::CatalogPersistence(format!("failed to create parent for catalog: {}", e))
        })?;
    }

    let json = serde_json::to_vec_pretty(snapshot)
        .map_err(|e| Error::CatalogPersistence(format!("failed to serialize catalog: {}", e)))?;

    fs::write(&path, json).map_err(|e| {
        Error::CatalogPersistence(format!("failed to write {}: {}", path.display(), e))
    })?;

    Ok(())
}

// Internal helpers

fn empty_snapshot() -> CatalogSnapshot {
    CatalogSnapshot {
        version: CATALOG_VERSION,
        generated_at: Utc::now(),
        datasets: vec![],
    }
}

/// Returns only directories inside `path` (ignores files and errors).
fn list_directories(path: &Path) -> Vec<PathBuf> {
    fs::read_dir(path)
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let entry = entry.ok()?;
            if entry.file_type().ok()?.is_dir() {
                Some(entry.path())
            } else {
                None
            }
        })
        .collect()
}

/// Discover dataset roots using a clean 4-level traversal
///   base/{exchange}/{category}/{symbol}/{interval}/
fn discover_dataset_roots(base: &Path) -> Result<Vec<PathBuf>> {
    let mut roots = Vec::new();

    for exchange_path in list_directories(base) {
        for category_path in list_directories(&exchange_path) {
            for symbol_path in list_directories(&category_path) {
                for interval_path in list_directories(&symbol_path) {
                    if looks_like_dataset_root(&interval_path) {
                        roots.push(interval_path);
                    }
                }
            }
        }
    }

    Ok(roots)
}

fn looks_like_dataset_root(dir: &Path) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };

    entries.flatten().any(|entry| {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        name_str.starts_with("year=") || name_str.ends_with(".parquet")
    })
}

/// Parse exchange / category / symbol / interval from the path relative to base.
fn parse_dataset_labels(
    dataset_root: &Path,
    base: &Path,
) -> Option<(String, String, String, String)> {
    let relative = dataset_root.strip_prefix(base).ok()?;
    let mut components = relative.components();

    let exchange = components.next()?.as_os_str().to_str()?.to_string();
    let category = components.next()?.as_os_str().to_str()?.to_string();
    let symbol = components.next()?.as_os_str().to_str()?.to_string();
    let interval = components.next()?.as_os_str().to_str()?.to_string();

    Some((exchange, category, symbol, interval))
}

/// Compute min/max/count + on-disk size for one dataset root (the interval dir).
fn compute_coverage_for_dataset(
    dataset_root: &Path,
    base: &Path,
) -> Result<Option<DatasetCoverage>> {
    let (exchange, category, symbol, interval) = match parse_dataset_labels(dataset_root, base) {
        Some(labels) => labels,
        None => return Ok(None),
    };

    // Build glob for all data.parquet under this dataset root.
    let glob_pattern = dataset_root
        .join("year=*")
        .join("month=*")
        .join("day=*")
        .join("data.parquet");
    let glob_str = match glob_pattern.to_str() {
        Some(s) => s,
        None => return Ok(None),
    };

    // Use the same LazyFrame + statistics pattern already proven in parquet.rs.
    let lf = LazyFrame::scan_parquet(PlRefPath::new(glob_str), Default::default())?;

    let stats_df = lf
        .select([
            col("timestamp").min().alias("from"),
            col("timestamp").max().alias("to"),
            col("timestamp").count().alias("record_count"),
        ])
        .collect()?;

    let from = stats_df.column("from")?.i64()?.get(0).unwrap_or(0);
    let to = stats_df.column("to")?.i64()?.get(0).unwrap_or(0);
    let record_count = stats_df.column("record_count")?.u32()?.get(0).unwrap_or(0) as u64;

    if record_count == 0 {
        return Ok(None);
    }

    let approx_size_bytes = compute_dir_size(dataset_root)?;

    Ok(Some(DatasetCoverage {
        exchange,
        category,
        symbol,
        interval,
        from,
        to,
        record_count,
        approx_size_bytes,
        last_updated: Utc::now(),
    }))
}

/// Recursively sum the size of all `data.parquet` files under `root`.
fn compute_dir_size(root: &Path) -> Result<u64> {
    let mut total: u64 = 0;

    fn walk(dir: &Path, total: &mut u64) {
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };

        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else { continue };

            if meta.is_file() && entry.file_name() == "data.parquet" {
                *total += meta.len();
            } else if meta.is_dir() {
                walk(&entry.path(), total);
            }
        }
    }

    walk(root, &mut total);
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parquet::write_candles_partitioned;
    use common::types::{Candle, Exchange, MarketCategory};
    use tempfile::TempDir;

    fn make_test_candles(n: usize, start_ts: i64) -> Vec<Candle> {
        (0..n)
            .map(|i| Candle {
                timestamp: start_ts + (i as i64 * 60_000),
                open: 100.0 + i as f64,
                high: 101.0 + i as f64,
                low: 99.0 + i as f64,
                close: 100.5 + i as f64,
                volume: 1_000.0,
            })
            .collect()
    }

    #[test]
    fn test_build_snapshot_and_roundtrip() {
        let temp = TempDir::new().unwrap();
        let base = temp.path();

        // Write a tiny dataset for BTCUSDT spot on bybit.
        let candles = make_test_candles(120, 1_700_000_000_000);
        write_candles_partitioned(
            &candles,
            Exchange::Bybit.as_str(),
            MarketCategory::Spot.as_str(),
            "BTCUSDT",
            "1min",
            base,
        )
        .unwrap();

        // Also write a second symbol to prove multiple datasets are found.
        let eth_candles = make_test_candles(60, 1_700_000_000_000);
        write_candles_partitioned(
            &eth_candles,
            Exchange::Bybit.as_str(),
            MarketCategory::Spot.as_str(),
            "ETHUSDT",
            "1min",
            base,
        )
        .unwrap();

        // Build snapshot from disk.
        let snapshot = build_snapshot(base).unwrap();
        assert_eq!(snapshot.version, CATALOG_VERSION);
        assert_eq!(snapshot.datasets.len(), 2);

        // Find BTC entry.
        let btc = snapshot
            .datasets
            .iter()
            .find(|d| d.symbol == "BTCUSDT")
            .expect("BTCUSDT dataset should be present");

        assert_eq!(btc.exchange, "bybit");
        assert_eq!(btc.category, "spot");
        assert_eq!(btc.interval, "1min");
        assert_eq!(btc.record_count, 120);
        assert!(btc.from > 0 && btc.to > btc.from);
        assert!(btc.approx_size_bytes > 0);

        // Round-trip via JSON file.
        save_to_file(base, &snapshot).unwrap();

        let loaded = load_from_file(base)
            .unwrap()
            .expect("catalog.json should exist after save");
        assert_eq!(loaded.datasets.len(), 2);

        // Sanity: deleting the file makes load return None again.
        fs::remove_file(base.join(CATALOG_FILE_NAME)).unwrap();
        let again = load_from_file(base).unwrap();
        assert!(again.is_none());
    }

    #[test]
    fn test_empty_base_dir() {
        let temp = TempDir::new().unwrap();
        let snapshot = build_snapshot(temp.path()).unwrap();
        assert!(snapshot.datasets.is_empty());
    }
}
