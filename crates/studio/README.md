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

## Indicator catalog

`IndicatorCatalog` is built from `NodeRegistry::indicator_metas()` and serializes each indicator kind with its input/output ports and scalar params (type, default, min, max). The backend exposes it at `GET /api/v1/catalog/indicators`; the Market Research UI uses it to populate the indicator browser.

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
  error.rs       # graph/runtime errors
  registry.rs    # NodeRegistry, builtin_registry()
  runtime/
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