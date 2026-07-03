# Warehouse

Local Parquet storage, dataset discovery, candle reads, and resampling for the backend and studio data sources.

## Storage layout

Candles are stored as **Hive-partitioned Parquet** under a configurable base directory (`parquet_base_dir` in backend config; default `/tmp/agentic-quant-studio/parquet`):

```
{base}/{exchange}/{category}/{symbol}/interval=1min/year=YYYY/month=MM/day=DD/data.parquet
```

Ingest always writes **1-minute** bars. The backend resamples to other intervals on read (e.g. `1d`, `1h`) via `resample_candles`.

## Catalog

`catalog.rs` scans the on-disk layout and builds a `CatalogSnapshot` (`catalog.json`):

- Per-dataset coverage: exchange, category, symbol, interval, time range, row count, approximate size
- Exposed by the backend as `GET /api/v1/catalog/candles`
- Refreshed after `ingest_candles` jobs and via `POST /api/v1/catalog/candles/refresh`

## Read path

| Module | Role |
|--------|------|
| `parquet.rs` | Partitioned writes, range scans, load 1m candles, `resample_candles` |
| `query.rs` | Resolve `?start=`, `?end=`, `?limit=` into a bounded millisecond window |
| `candle_downloader.rs` | Exchange download → partitioned Parquet writes |

## Data sources

- **Exchange:** Bybit only today (`api-client` crate)
- Ingestion is triggered via backend `ingest_candles` jobs, not direct warehouse APIs

## Layout

```
src/
  catalog.rs           # Hive scan, catalog.json snapshot
  parquet.rs           # Read/write partitioned Parquet, resampling
  query.rs             # Candle query window resolution
  candle_downloader.rs # Bybit → Parquet ingest
  error.rs
```

## Tests

```bash
cargo test -p warehouse
```