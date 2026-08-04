# MCP server (`aqs-mcp`)

Stdio [Model Context Protocol](https://modelcontextprotocol.io/) server for **Agentic Quant Studio**.  
It is a thin tool host over the running **backend HTTP API** (`AQS_BACKEND_URL`).

```text
Agent host (Claude / Cursor / …)
        │  stdio MCP
        ▼
     aqs-mcp
        │  HTTP
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

## Tools (scaffold)

| Tool | Backend |
|------|---------|
| `list_indicators` | `GET /catalog/indicators` |
| `list_candle_datasets` | `GET /catalog/candles` |
| `list_node_kinds` | indicators + static datasource/logic/literal kinds |
| `validate_graph` | `POST /studio/validate` |
| `create_study` | `POST /studies` (**always** `created_by: agent`) |
| `list_studies` | `GET /studies` |
| `get_study` | `GET /studies/{id}` |

No accept/delete tools — the user accepts drafts in the Market Research UI.

## Host config (stdio)

Claude Desktop / Cursor-style:

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

1. `list_candle_datasets` / `list_indicators`  
2. Build a `GraphSpec` (e.g. candles + SMA)  
3. `validate_graph`  
4. `create_study` with title  
5. User opens FE → Reload → select draft → Accept  

## Tests

```bash
cargo test -p mcp-server
```
