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
| `kind` | Registry key, e.g. `indicator.sma`, `output.series` |
| `params` | Node-specific JSON parameters |

### PortRef

Edges connect named ports using `node_id.port_name` strings in JSON:

```json
{ "from": "sma20.value", "to": "out_fast.series" }
```

## Runtime

```rust
use studio::{
    registry::builtin_registry,
    runtime::{execute, validate},
    spec::GraphSpec,
};

let graph: GraphSpec = serde_json::from_str(json)?;
let registry = builtin_registry();

validate(&graph, &registry)?;
let store = execute(&graph, &registry)?;
```

`validate` checks:

- unique node ids
- known node kinds (registry lookup)
- at most one wire per input port
- port existence and type compatibility on every edge
- acyclic graph (topological sort)

`execute` re-validates, topologically sorts nodes, resolves inputs from wired ports, and runs each `NodeOp` in order. Results land in a `PortStore` keyed by `PortRef`.

## Built-in nodes

Registered via `builtin_registry()` / `nodes::register_builtins`:

| Kind | Category |
|------|----------|
| `indicator.sma` | Indicator |
| `output.series` | Output |
| `output.signal` | Output |

`datasource.candles` and other data-source ops are planned for a follow-up PR.

## Example

Runnable subgraph (SMA into output series):

```json
{
  "id": "sma-output",
  "version": 1,
  "kind": "chart",
  "nodes": [
    { "id": "sma20", "kind": "indicator.sma", "params": { "period": 20 } },
    { "id": "out_fast", "kind": "output.series", "params": { "label": "SMA 20" } }
  ],
  "edges": [
    { "from": "sma20.value", "to": "out_fast.series" }
  ]
}
```

`validate` still requires every declared input port to be wired, so leaf nodes such as `indicator.sma` need their inputs populated via `PortStore` before `execute` in integration tests today. Full end-to-end charts (candle datasource → indicators → outputs) depend on the datasource node landing next.

## Layout

```
src/
  spec/          # GraphSpec, NodeSpec, Edge, PortRef
  error.rs       # graph/runtime errors
  registry.rs    # NodeRegistry, builtin_registry()
  runtime/
    validate.rs  # graph validation
    plan.rs      # topological sort / execution order
    execute.rs   # graph executor, PortStore
    node.rs      # NodeOp trait, port/param metadata
    value.rs     # SeriesF64, SeriesBool, Value
  nodes/
    indicator/   # indicator.sma
    output/      # output.series, output.signal
```

## Tests

```bash
cargo test -p studio
```

Coverage includes spec serde/roundtrip, `PortRef` validation, graph validation, topological sort, SMA/output node ops, and port-store execution paths.