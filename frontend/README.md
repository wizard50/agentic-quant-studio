# Frontend

Next.js app for Agentic Quant Studio — **Market Research** (`/`) and **Data Management** (`/data`).

API calls are proxied through Next.js: `/api/backend/v1/...` → backend `/api/v1/...` (see `next.config.ts`).

## Development

Use a different port than the Rust backend (both default to 3000). From the repo root:

```bash
# Terminal 1 — backend
cargo run -p backend

# Terminal 2 — frontend
cd frontend
npm install
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:3000 npm run dev -- -p 3001
```

Open http://localhost:3001. Repo overview: [root README](../README.md). Backend API: [crates/backend/README.md](../crates/backend/README.md).

## Pages

### Market Research (`/`)

- Candle chart ([TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/)) backed by stored Parquet data
- Exchange / category / symbol / interval controls
- **Catalog-gated chart** — waits for `GET /catalog/candles` before loading; links to `/data` when no datasets exist
- **Infinite history scroll** — paged loads (500 bars), debounced prefetch, viewport preserved on prepend
- **Dynamic indicators** — browse `GET /catalog/indicators`, add layers, show/hide series, edit params, per-pane legends
- **Per-layer colors** — distinct line color from a 10-color pool

### Data Management (`/data`)

- KPI cards — dataset count, candles, storage, active jobs
- Searchable datasets table from the catalog snapshot
- Quick Ingest — queue `ingest_candles` jobs (Bybit spot/linear today)
- Active jobs — pending/running counts from `GET /api/v1/jobs?active=true`

## Chart architecture

The Market Research page renders a single `ChartBlock`.

- **Layers mode** — `ChartLayer[]` → `buildChartBlockSpecFromLayers` → run + render
- **Study mode** — `Study.graph` + **`Study.presentation`** (server `compile_presentation`) → `buildChartBlockSpecFromStudy` (no client re-layout). Marker layers use `visual: "markers"`.

```
ChartLayer[]  (document — store, UI, future persistence/agents)
      │
      ▼  buildChartBlockSpecFromLayers(marketDataKey, layers)
ChartBlockSpec  (derived — graph, outputs, panes, port wiring)
      │
      ├─► Datafeed → buildStudioRunRequest → POST /studio/runs
      └─► LW Charts panes + series hooks
```

| Concern | Location | Role |
|---------|----------|------|
| Document | `stores/useChartLayersStore.ts`, `lib/chart-block/layers.ts` | Market + indicator layers (`kind`, `params`, `visible`, `color`); volume builtin |
| Compile | `lib/chart-block/buildChartBlockSpec.ts` | Derive `GraphSpec`, outputs, pane layout — not persisted |
| Registry | `lib/indicators/` | Catalog-driven definitions via `hydrateIndicatorRegistry` |
| Data | `lib/chart/datafeed.ts` | Paged studio runs, candle cache, typed events |
| UI | `components/chart/`, `hooks/chart/` | Chart block, legends, indicator browser |

`IndicatorRegistryHydrator` (in `app/layout.tsx`) loads `GET /catalog/indicators` and builds `lookupIndicatorDefinition(kind)` with generic wiring for standard single-input/single-output indicators. The only frontend-only kind is `builtin.volume`.

Graph node ids must not contain `.` (port refs use `node_id.port_name`); layer ids look like `indicator-sma-{timestamp}-{n}`.

### Chart UI

| Piece | Role |
|-------|------|
| `IndicatorBrowser` | Catalog picker — adds layers with default params |
| `PaneLegend` | Per-pane layer legend overlay |
| `IndicatorLayerRow` | Show/hide, settings, remove |
| `IndicatorSettingsDialog` | Edit params from registry `configSchema` (from catalog) |
| `ChartBlock` | Chart surface, status overlays, legend positioning |

### Chart stack

Event-driven datafeed — components subscribe to typed events instead of fetching directly.

| Piece | Role |
|-------|------|
| `Datafeed` | Paged studio graph fetch (`PAGE_SIZE` 500), `loadInitial` / `loadOlder` |
| `CandleCache` | Sorted candle store; merge on prepend |
| `datafeedEvent.ts` | Maps events to series; `preserveViewportOnPrepend` |
| `useChartBlockData` | Builds `ChartBlockSpec`, owns feed + status |
| `useChartBlockPane` | Single LW Charts instance (price, volume, subcharts) |
| `useLineLayerSeries` | Indicator lines on main and subchart panes |
| `useBlockNativeLayers` | Candlestick and histogram series |
| `useChartHistoryScroll` | Triggers `loadOlder()` from visible range |
| `useChartResize` | ResizeObserver + pane layout refresh |

**Datafeed events:** `replace`, `prepend`, `loading`, `paging`, `pageError`, `rangeBoundary`, `reset`.

## Tests

```bash
npm test
```

Vitest covers datafeed, chart-block spec compile, catalog-driven registry, pane layout, and layer store. Setup hydrates the registry from `lib/indicators/testCatalog.ts`.

## Key paths

```
app/
  page.tsx              # Market Research
  data/page.tsx         # Data Management
  layout.tsx            # QueryProvider + IndicatorRegistryHydrator
components/chart/       # ChartBlock, legends, indicator browser
components/providers/   # IndicatorRegistryHydrator
hooks/chart/            # Block data, pane, line series, scroll, resize
lib/chart-block/        # Spec compile, run requests, pane layout
lib/indicators/         # Catalog client, registry hydration, render helpers
lib/chart/              # Datafeed, cache, viewport preservation
stores/                 # Chart layers, trading controls
```