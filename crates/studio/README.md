# Studio

Computation graph crate for Agentic Quant Studio. Defines the declarative spec agents produce and the runtime that validates and executes it.

## GraphSpec

`GraphSpec` is the execution topology: node list, port-to-port edges, and graph intent. It intentionally excludes UI metadata (positions, labels, groups) — that will live in a separate `GraphExtSpec` later.

| Field | Description |
|-------|-------------|
| `id` | Stable identifier (slug) |
| `version` | Schema revision for migrations |
| `kind` | Graph intent — `chart` today; `strategy` later |
| `nodes` | Array of node definitions |
| `edges` | Port-to-port connections |

Helpers on `GraphSpec`:

- `node(id)` — look up a node by id
- `edge_to(port)` — look up the wire into an input port

### NodeSpec

| Field | Description |
|-------|-------------|
| `id` | Unique node id within the graph |
| `kind` | Registry key, e.g. `datasource.candles`, `indicator.sma` |
| `params` | Node-specific JSON parameters |

### PortRef

Edges connect named ports using `node_id.port_name` strings in JSON:

```json
{ "from": "ds1.close", "to": "sma20.input" }
```

## Runtime

```rust
use std::sync::Arc;

use studio::{
    registry::builtin_registry,
    runtime::{ExecutionContext, FakeCandleSource, execute, validate},
    spec::GraphSpec,
};

let graph: GraphSpec = serde_json::from_str(json)?;
let registry = builtin_registry();
let ctx = ExecutionContext::new(Arc::new(FakeCandleSource::new(vec![])));

validate(&graph, &registry)?;
let store = execute(&graph, &registry, &ctx).await?;
```

`validate` checks:

- unique node ids
- known node kinds (registry lookup)
- at most one wire per input port
- port existence and type compatibility on every edge
- acyclic graph (topological sort)

`execute` re-validates, topologically sorts nodes, resolves inputs from wired ports, and runs each `NodeOp` in order. Results land in a `PortStore` keyed by `PortRef`. Data-source nodes load candles via `ExecutionContext` and `CandleSource`.

The backend `POST /api/v1/studio/runs` endpoint wraps a `GraphSpec` with an `outputs` list of port strings (`node_id.port_name`) and returns only the requested ports plus run `meta`.

UI metadata (node positions, labels, editor groups) will live in a separate **`GraphExtSpec`** later — not mixed into `GraphSpec`.

### HTTP example

```bash
curl -s -X POST http://127.0.0.1:3000/api/v1/studio/runs \
  -H "Content-Type: application/json" \
  -d '{
    "graph": {
      "id": "ds-sma",
      "version": 1,
      "kind": "chart",
      "nodes": [
        {
          "id": "ds1",
          "kind": "datasource.candles",
          "params": {
            "exchange": "bybit",
            "category": "spot",
            "symbol": "BTCUSDT",
            "interval": "1d"
          }
        },
        { "id": "sma20", "kind": "indicator.sma", "params": { "period": 20 } }
      ],
      "edges": [{ "from": "ds1.close", "to": "sma20.input" }]
    },
    "outputs": ["ds1.timestamp", "ds1.close", "sma20.value"]
  }' | jq '.outputs["sma20.value"]'
```

## Indicator catalog

`IndicatorCatalog` is built from `NodeRegistry::indicator_metas()` and serializes each indicator kind with its input/output ports, scalar params (type, default, min, max), and optional chart metadata. The backend exposes it at `GET /api/v1/catalog/indicators`; the Market Research UI uses it to populate the indicator browser and to hydrate the frontend indicator registry at runtime.

### ChartDefaults

Indicator nodes may attach `chart_defaults` on `NodeMeta` to describe how the presentation compiler places and scales a series:

| Field | Description |
|-------|-------------|
| `role` | `overlay` (main price pane) or `subchart` (separate pane below) |
| `value_range` | Optional fixed Y range (`min`, `max`) for subcharts such as RSI |
| `warmup_bars` | Optional history prefetch hint for viewport loads |

Helpers in `nodes/indicator/common.rs`:

- `overlay_chart_defaults(warmup_bars)` — SMA/EMA-style overlays
- `subchart_chart_defaults(warmup_bars, min, max)` — bounded subcharts such as RSI

Example catalog entry shape:

```json
{
  "kind": "indicator.rsi",
  "inputs": [{ "name": "input", "type": "number", "series": true }],
  "outputs": [{ "name": "value", "type": "number", "series": true }],
  "params": [{ "name": "period", "type": "integer", "default": 14, "min": 1 }],
  "chart_defaults": {
    "role": "subchart",
    "value_range": { "min": 0.0, "max": 100.0 },
    "warmup_bars": 14
  }
}
```


## Presentation compiler

`compile_presentation(graph, registry)` derives a **`PresentationSpec`** (panes, layers, outputs) from a pure `GraphSpec` and registry `chart_defaults`. Agents and studies author only the graph; layout is computed.

| Rule | Behavior |
|------|----------|
| `datasource.candles` | Candlestick layer on main (`id: candles`) |
| `indicator.*` | `overlay` → main; `subchart` → own pane (`id` = node id); unknown kinds → overlay |
| `literal.number` | Line on consumer-peer context pane; orphans (no outgoing edges) skipped |
| `logic.*` | Markers on input-context pane |

`PresentationSpec` does **not** embed the graph (callers already hold `GraphSpec`). `outputs` is the sorted unique set of layer port refs for `POST /studio/runs`.

```rust
use studio::{presentation::compile_presentation, registry::builtin_registry};

let registry = builtin_registry();
let presentation = compile_presentation(&graph, &registry)?;
// presentation.panes, presentation.outputs
```

UI editor metadata (node positions, labels) remains a future **`GraphExtSpec`** — separate from chart presentation.

## Built-in nodes

Registered via `builtin_registry()` / `nodes::register_builtins`:

| Kind | Category |
|------|----------|
| `datasource.candles` | DataSource |
| `indicator.sma` | Indicator |
| `indicator.ema` | Indicator |
| `indicator.rsi` | Indicator |

## Example

Datasource into SMA:

```json
{
  "id": "ds-sma",
  "version": 1,
  "kind": "chart",
  "nodes": [
    {
      "id": "ds1",
      "kind": "datasource.candles",
      "params": {
        "exchange": "bybit",
        "category": "spot",
        "symbol": "BTCUSDT",
        "interval": "1d"
      }
    },
    { "id": "sma20", "kind": "indicator.sma", "params": { "period": 20 } }
  ],
  "edges": [
    { "from": "ds1.close", "to": "sma20.input" }
  ]
}
```

## Layout

```
src/
  spec/          # GraphSpec, NodeSpec, Edge, PortRef
  catalog.rs     # IndicatorCatalog (from registry metadata)
  presentation/  # PresentationSpec + compile_presentation
  error.rs       # graph/runtime errors
  registry.rs    # NodeRegistry, builtin_registry()
  runtime/
    display.rs   # ChartRole, ChartDefaults (overlay / subchart metadata)
    context.rs   # ExecutionContext, CandleSource
    candles.rs   # CandleQuery, candles_to_series
    validate.rs  # graph validation
    plan.rs      # topological sort / execution order
    execute.rs   # graph executor, PortStore
    node.rs      # NodeOp trait, port/param metadata
    value.rs     # SeriesI64, SeriesF64, SeriesBool, Value
  nodes/
    datasource/  # datasource.candles
    indicator/   # indicator.sma, indicator.ema, indicator.rsi (+ common helpers)
```

## Tests

```bash
cargo test -p studio
```

Coverage includes spec serde/roundtrip, `PortRef` validation, graph validation, topological sort, datasource/SMA node ops, and port-store execution paths.