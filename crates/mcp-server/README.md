# MCP server (`aqs-mcp`)

Stdio [Model Context Protocol](https://modelcontextprotocol.io/) server for **Agentic Quant Studio**.  
Thin host over the running **backend HTTP API** (`AQS_BACKEND_URL`), plus **resources** (docs/schema/examples) and **prompts** (user workflows).

**Demo:** [MCP end-to-end on YouTube](https://www.youtube.com/watch?v=V80_Kx98FMM)

```text
Agent host (Claude / Cursor / Grok / …)
        │  stdio MCP
        ▼
     aqs-mcp
        │  HTTP (tools that need live data)
        ▼
  backend :3000  /api/v1/...
```

## Prerequisites

```bash
# Terminal 1 — backend must be running
cargo run -p backend
```

## Run

```bash
cargo run -p mcp-server
# binary: target/debug/aqs-mcp
```

| Env | Default |
|-----|---------|
| `AQS_BACKEND_URL` | `http://127.0.0.1:3000` |

Logs go to **stderr** only (stdout is the MCP JSON-RPC channel).

## Primitives

### Tools (model-controlled, live / actions)

| Tool | Backend / source |
|------|------------------|
| `list_indicators` | `GET /catalog/indicators` |
| `list_candle_datasets` | `GET /catalog/candles` |
| `list_node_kinds` | Studio registry (all kinds + ports/params) |
| `validate_graph` | `POST /studio/validate` |
| `create_study` | `POST /studies` (**always** `created_by: agent`) |
| `list_studies` | `GET /studies` |
| `get_study` | `GET /studies/{id}` |

No accept/delete tools — the user accepts drafts in the Market Research UI.  
No `update_study` yet — revise via get → edit → `create_study` (new draft).

### Resources (context / documentation)

Static files live under [`resources/`](resources/) and are embedded at compile time (`include_str!`).

| URI | Source file |
|-----|-------------|
| `aqs://docs/overview` | `resources/docs/overview.md` |
| `aqs://docs/graph-spec` | `resources/docs/graph-spec.md` |
| `aqs://docs/presentation-rules` | `resources/docs/presentation-rules.md` |
| `aqs://docs/examples/sma-overlay` | `resources/examples/sma-overlay.json` |
| `aqs://docs/examples/golden-cross` | `resources/examples/golden-cross.json` |
| `aqs://docs/examples/rsi-reclaim` | `resources/examples/rsi-reclaim.json` |
| `aqs://schema/node-kinds` | Generated from studio registry at runtime |
| `aqs://schema/kinds/{kind}` | Generated (template) |

Server instructions point agents at `aqs://docs/overview` first. Edit the markdown/JSON under `resources/`, then rebuild `aqs-mcp`.

### Prompts (user-started recipes)

| Prompt | Args | Purpose |
|--------|------|---------|
| `create_chart_study` | exchange, category, symbol, interval, title?, style? | Draft SMA / golden_cross / rsi_reclaim |
| `create_golden_cross` | market fields, title? | Dual SMA + crossover draft |
| `revise_draft_study` | study_id, change_request | Load, edit, **new** draft |

## Host config (stdio)

Claude Desktop / Cursor / Grok-style:

```json
{
  "mcpServers": {
    "agentic-quant-studio": {
      "command": "/absolute/path/to/agentic-quant-studio/target/debug/aqs-mcp",
      "env": {
        "AQS_BACKEND_URL": "http://127.0.0.1:3000"
      }
    }
  }
}
```

Build first: `cargo build -p mcp-server`.

## Example agent flow

1. Read resource `aqs://docs/overview` (and examples/schema as needed)  
2. `list_candle_datasets` / `list_node_kinds`  
3. Build a `GraphSpec` (e.g. candles + SMA, or golden cross)  
4. `validate_graph`  
5. `create_study` with title  
6. User opens FE → Reload → select draft → Accept  

## Best practice (discovery)

| Layer | What |
|-------|------|
| Server instructions | Short policy + pointer to resources |
| Resources | Docs, examples, full kind schemas |
| Tools | Live catalogs + validate + create/list/get |
| Prompts | Optional user-started happy paths |

Do not invent logic/literal port names — use `list_node_kinds` or `aqs://schema/kinds/…`.

## Tests

```bash
cargo test -p mcp-server
cargo test -p studio catalog
```
