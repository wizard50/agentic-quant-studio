# Backend

Axum HTTP API for candles, catalogs, studio graph runs, studies, and background jobs. Default listen address: `127.0.0.1:3000` (`config/defaults.toml`).

## Run

From the repo root:

```bash
cargo run -p backend
```

Configuration:

- `config/defaults.toml` — shipped defaults
- `~/.config/agentic-quant-studio/config.toml` — user overrides
- Env vars prefixed with `AGENTIC_QUANT_STUDIO__` (see `config/example.toml`)

`parquet_base_dir` in config points at the warehouse root (default `/tmp/agentic-quant-studio/parquet`).

## API (v1)

Base path: `/api/v1`. The Next.js frontend proxies these as `/api/backend/v1/...`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candles/{exchange}/{category}/{symbol}/{interval}` | Load candles from Parquet — `?start=`, `?end=`, `?limit=`; **404** if dataset missing |
| POST | `/jobs` | Enqueue a job |
| GET | `/jobs` | List jobs — `?kind=`, `?active=true`, `?status=pending,running`, `?limit=` (max 500) |
| GET | `/jobs/{id}` | Single job status |
| GET | `/catalog/candles` | Candle dataset catalog snapshot |
| GET | `/catalog/indicators` | Indicator catalog from studio registry |
| POST | `/catalog/candles/refresh` | Background catalog rescan (202, not a job) |
| POST | `/studio/runs` | Execute a graph — `{ graph, outputs }` → port values + `meta` |
| POST | `/studio/validate` | Validate a graph only — `{ graph }` → `{ ok: true }` (no execute/persist) |
| GET | `/studies` | List studies — `?status=draft,applied` (default: draft+applied; include `archived` via query) |
| POST | `/studies` | Create **draft** — `{ graph, title?, created_by?, presentation_overrides? }` → **201** |
| GET | `/studies/{id}` | Get one study — **404** if missing |
| PUT | `/studies/{id}` | Update **draft** (`graph` / title / overrides / `expected_version`) and/or accept (`status: "applied"`) |
| DELETE | `/studies/{id}` | Delete draft or archived — **409** if applied |

Job statuses: `pending`, `running`, `completed`, `failed`, `cancelled`.

**Studies** are a flat in-memory registry (lost on restart). Statuses: `draft`, `applied`, `archived`. At most one `applied` study. `Study.version` is the study revision for concurrency — not `graph.version`. To derive a new draft from an existing study, `GET` it and `POST /studies` with the graph (no server-side fork).

### Examples

```bash
# Candle catalog size
curl -s http://127.0.0.1:3000/api/v1/catalog/candles | jq '.datasets | length'

# Indicator catalog
curl -s http://127.0.0.1:3000/api/v1/catalog/indicators | jq '.indicators[] | {kind, params, chart_defaults}'

# Load candles
curl -s "http://127.0.0.1:3000/api/v1/candles/bybit/spot/BTCUSDT/1m?limit=100" | jq 'length'

# Enqueue ingestion
curl -X POST http://127.0.0.1:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"type":"ingest_candles","payload":{"exchange":"bybit","category":"spot","symbol":"SOLUSDT"}}'

# Active ingestion jobs
curl -s "http://127.0.0.1:3000/api/v1/jobs?active=true&kind=ingest_candles" | jq

# Create a study draft (agent path)
curl -s -X POST http://127.0.0.1:3000/api/v1/studies \
  -H "Content-Type: application/json" \
  -d '{"graph":{"id":"g1","version":1,"kind":"chart","nodes":[],"edges":[]},"created_by":"agent","title":"demo"}' | jq

# List drafts + applied
curl -s http://127.0.0.1:3000/api/v1/studies | jq

# Accept draft as applied
curl -s -X PUT http://127.0.0.1:3000/api/v1/studies/STUDY_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"applied"}' | jq
```

Studio run requests are documented in [`../studio/README.md`](../studio/README.md).

## Background jobs

Generic job system in `src/jobs/` — not candle-specific routes.

| Piece | Role |
|-------|------|
| `Job` enum | Tagged JSON (`type` + `payload`); extensible |
| `JobQueue` | In-memory status (`DashMap`) + single worker (`mpsc`) |
| `processors/` | Per-type handlers (today: `ingest_candles`) |

**`ingest_candles`** — downloads candle history (full or incremental from last Parquet timestamp), writes via warehouse, then refreshes the candle catalog.

**Limitations:**

- Jobs are **in memory only** — lost on restart
- **One worker**, sequential execution
- Duplicate active jobs (same kind + signature) → **409 Conflict** with existing job id
- `POST /catalog/candles/refresh` is fire-and-forget, not tracked as a job

## Layout

```
src/
  handlers/     # candles, catalog, jobs, studio, studies
  jobs/         # queue, worker, types, processors
  services/     # candle_service, studio_candles, study_store
  models/       # API request/response types
  catalog.rs    # in-process candle catalog handle
  config.rs
  router.rs
  main.rs
bin/
  seed.rs       # seed utility
```
