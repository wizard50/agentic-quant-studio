# Studio

Computation graph crate for Agentic Quant Studio. Defines the declarative spec agents produce and the runtime executes.

## GraphSpec

`GraphSpec` is the execution topology: node list, port-to-port edges, and graph intent. It intentionally excludes UI metadata (positions, labels, groups) — that will live in a separate `GraphExtSpec` later.

| Field | Description |
|-------|-------------|
| `id` | Stable identifier (slug) |
| `version` | Schema revision for migrations |
| `kind` | Graph intent — `chart` today; `strategy` later |
| `nodes` | Array of node definitions |
| `edges` | Port-to-port connections |

### NodeSpec

| Field | Description |
|-------|-------------|
| `id` | Unique node id within the graph |
| `kind` | Registry key, e.g. `indicator.sma`, `datasource.candles` |
| `params` | Node-specific JSON parameters |

### PortRef

Edges connect named ports using `node_id.port_name` strings in JSON:

```json
{ "from": "ds1.close", "to": "sma20.input" }
```

## Example

```json
{
  "id": "golden-cross-btc-1d",
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
    { "id": "sma20", "kind": "indicator.sma", "params": { "period": 20 } },
    { "id": "sma50", "kind": "indicator.sma", "params": { "period": 50 } },
    { "id": "cross", "kind": "logic.crossover", "params": {} },
    { "id": "out_fast", "kind": "output.series", "params": { "label": "SMA 20" } },
    { "id": "out_sig", "kind": "output.signal", "params": { "label": "Golden cross" } }
  ],
  "edges": [
    { "from": "ds1.close", "to": "sma20.input" },
    { "from": "ds1.close", "to": "sma50.input" },
    { "from": "sma20.value", "to": "cross.fast" },
    { "from": "sma50.value", "to": "cross.slow" },
    { "from": "sma20.value", "to": "out_fast.series" },
    { "from": "cross.signal", "to": "out_sig.signal" }
  ]
}
```

## Layout

```
src/
  spec/          # GraphSpec, NodeSpec, Edge, PortRef
  error.rs       # PortRef parse/validation errors
```

`runtime/` and `nodes/` will be added in follow-up work.

## Tests

```bash
cargo test -p studio
```

Spec tests cover `PortRef` parsing/validation, edge JSON format, `GraphKind` lowercase serde, and a full `GraphSpec` roundtrip.