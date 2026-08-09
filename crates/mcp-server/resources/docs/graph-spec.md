# GraphSpec

Computation topology only (no UI positions). Shape:

```json
{
  "id": "my-study-slug",
  "version": 1,
  "kind": "chart",
  "nodes": [
    { "id": "ds1", "kind": "datasource.candles", "params": { ... } },
    { "id": "sma20", "kind": "indicator.sma", "params": { "period": 20 } }
  ],
  "edges": [
    { "from": "ds1.close", "to": "sma20.input" }
  ]
}
```

## Rules

- `kind` is graph intent: `chart` today.
- `version` is GraphSpec schema revision (usually `1`), not study revision.
- Each node: unique `id` (no dots), registry `kind`, JSON `params`.
- Edges connect output ports to input ports as strings `node_id.port_name`.
- At most one wire per input port; graph must be acyclic.
- Unknown kinds or wrong port types fail `validate_graph`.

## Common datasource params (`datasource.candles`)

| Param | Type | Notes |
|-------|------|--------|
| exchange | string | e.g. `bybit` |
| category | string | e.g. `spot` |
| symbol | string | e.g. `BTCUSDT` |
| interval | string | e.g. `1d`, `1h` |

Use `list_candle_datasets` so the market exists in the warehouse.

## Indicators

Params and ports: `list_indicators` or `aqs://schema/kinds/indicator.sma` (etc.).
Typical: input series → `input`, output → `value`.

## Logic / literal

Full ports: `aqs://schema/node-kinds`. Examples:

- `logic.crossover`: inputs `fast`, `slow` (series number); output `signal` (series bool) → chart markers.
- `literal.number`: param `value`; input `reference` (usually `ds1.timestamp`); output `value` series.
